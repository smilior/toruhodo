import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { stripeCustomers } from "@/lib/db/schema";
import { stripe } from "@/lib/stripe/client";
import {
  claimWebhookEvent,
  markWebhookProcessed,
  releaseWebhookClaim,
  syncStripeSubscription,
} from "@/lib/stripe/sync";

export const runtime = "nodejs";

function subscriptionIdFrom(
  value: string | Stripe.Subscription | null | undefined,
): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

function customerIdFrom(
  value: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined,
): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const userId = session.client_reference_id;
  const customerId = customerIdFrom(session.customer);
  if (userId && customerId) {
    await db
      .insert(stripeCustomers)
      .values({ userId, stripeCustomerId: customerId })
      .onConflictDoNothing();
  }
  const subId = subscriptionIdFrom(session.subscription);
  if (subId) {
    await syncStripeSubscription(subId);
  }
}

async function handleCustomerDeleted(
  customer: Stripe.Customer | Stripe.DeletedCustomer,
): Promise<void> {
  await db
    .delete(stripeCustomers)
    .where(eq(stripeCustomers.stripeCustomerId, customer.id));
}

async function dispatch(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      await handleCheckoutSessionCompleted(
        event.data.object as Stripe.Checkout.Session,
      );
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await syncStripeSubscription(sub.id);
      break;
    }
    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.billing_reason === "subscription_cycle") {
        console.info("[stripe] subscription_cycle paid", {
          invoiceId: invoice.id,
        });
      }
      break;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      console.warn("[stripe] invoice.payment_failed", {
        invoiceId: invoice.id,
      });
      break;
    }
    case "customer.deleted": {
      await handleCustomerDeleted(
        event.data.object as Stripe.Customer | Stripe.DeletedCustomer,
      );
      break;
    }
    default:
      console.info("[stripe] unhandled event type", event.type);
  }
}

export async function POST(req: Request): Promise<Response> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[stripe] STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json(
      { error: "webhook secret not configured" },
      { status: 500 },
    );
  }

  const payload = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, sig, secret);
  } catch (err) {
    console.warn(
      "[stripe] signature verification failed",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const claim = await claimWebhookEvent({
    eventId: event.id,
    type: event.type,
    eventCreated: event.created,
  });
  if (claim === "skip") {
    return NextResponse.json({ received: true });
  }

  try {
    await dispatch(event);
    await markWebhookProcessed(event.id);
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[stripe] webhook processing failed", event.id, err);
    await releaseWebhookClaim(event.id);
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}
