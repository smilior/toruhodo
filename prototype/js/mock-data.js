/**
 * 撮るほど プロトタイプ — モックデータ
 *
 * localStorage キー:
 *   toruhodo.records  — 保存した旅の記録 (Record[])
 *   toruhodo.settings — 設定 { furiganaDefault, modeDefault, geoEnabled }
 */

const STORAGE_RECORDS = 'toruhodo.records';
const STORAGE_SETTINGS = 'toruhodo.settings';

/** サンプル解説（撮影後の成功結果） */
const MOCK_SUCCESS = {
  id: 'mock-ichirizuka',
  title: '旧東海道 一里塚跡',
  placeName: '神奈川県藤沢市',
  lat: 35.3389,
  lng: 139.4871,
  ocrRaw: '旧東海道一里塚跡\nここは日本橋から十二里の一里塚があったところである',
  easyText:
    '一里塚は、江戸時代のはじめ（今から約400年前）に、道を歩く人のためにつくられた「道しるべ」です。一里（約4キロ）ごとに土を盛って木を植え、旅人はその木かげでひと休みしました。ここには、その塚がありました。',
  easyRuby:
    '<ruby>一里塚<rt>いちりづか</rt></ruby>は、<ruby>江戸時代<rt>えどじだい</rt></ruby>のはじめ（<ruby>今<rt>いま</rt></ruby>から<ruby>約<rt>やく</rt></ruby>400<ruby>年前<rt>ねんまえ</rt></ruby>）に、<ruby>道<rt>みち</rt></ruby>を<ruby>歩<rt>ある</rt></ruby>く<ruby>人<rt>ひと</rt></ruby>のためにつくられた「<ruby>道<rt>みち</rt></ruby>しるべ」です。<ruby>一里<rt>いちり</rt></ruby>（<ruby>約<rt>やく</rt></ruby>4キロ）ごとに<ruby>土<rt>つち</rt></ruby>を<ruby>盛<rt>も</rt></ruby>って<ruby>木<rt>き</rt></ruby>を<ruby>植<rt>う</rt></ruby>え、<ruby>旅人<rt>たびびと</rt></ruby>はその<ruby>木<rt>こ</rt></ruby>かげでひと<ruby>休<rt>やす</rt></ruby>みしました。ここには、その<ruby>塚<rt>つか</rt></ruby>がありました。',
  detailText:
    '一里塚は、慶長九年（1604年）、江戸幕府の命により全国の主要街道に築かれた里程標です。日本橋を起点に一里（約3.9km）ごとに五間（約9m）四方の塚を築き、榎などを植えて目印としました。旅人には距離の目安であり、木陰の休み場でもありました。この塚は、東海道を江戸から数えて十二里目にあたります。',
  detailRuby:
    '<ruby>一里塚<rt>いちりづか</rt></ruby>は、<ruby>慶長<rt>けいちょう</rt></ruby>九<ruby>年<rt>ねん</rt></ruby>（1604<ruby>年<rt>ねん</rt></ruby>）、<ruby>江戸幕府<rt>えどばくふ</rt></ruby>の<ruby>命<rt>めい</rt></ruby>により<ruby>全国<rt>ぜんこく</rt></ruby>の<ruby>主要街道<rt>しゅようかいどう</rt></ruby>に<ruby>築<rt>きず</rt></ruby>かれた<ruby>里程標<rt>りていひょう</rt></ruby>です。<ruby>日本橋<rt>にほんばし</rt></ruby>を<ruby>起点<rt>きてん</rt></ruby>に<ruby>一里<rt>いちり</rt></ruby>（約3.9km）ごとに<ruby>五間<rt>ごけん</rt></ruby>（約9m）<ruby>四方<rt>しほう</rt></ruby>の<ruby>塚<rt>つか</rt></ruby>を<ruby>築<rt>きず</rt></ruby>き、<ruby>榎<rt>えのき</rt></ruby>などを<ruby>植<rt>う</rt></ruby>えて<ruby>目印<rt>めじるし</rt></ruby>としました。<ruby>旅人<rt>たびびと</rt></ruby>には<ruby>距離<rt>きょり</rt></ruby>の<ruby>目安<rt>めやす</rt></ruby>であり、<ruby>木陰<rt>こかげ</rt></ruby>の<ruby>休<rt>やす</rt></ruby>み<ruby>場<rt>ば</rt></ruby>でもありました。この<ruby>塚<rt>つか</rt></ruby>は、<ruby>東海道<rt>とうかいどう</rt></ruby>を<ruby>江戸<rt>えど</rt></ruby>から<ruby>数<rt>かぞ</rt></ruby>えて<ruby>十二里目<rt>じゅうにりめ</rt></ruby>にあたります。',
  aiNote:
    '塚には榎という木がよく植えられました。根がじょうぶで、大きな木かげをつくるからだと言われています。このあたりには、ほかにも当時の道しるべが残っています。',
  aiNoteRuby:
    '<ruby>塚<rt>つか</rt></ruby>には<ruby>榎<rt>えのき</rt></ruby>という<ruby>木<rt>き</rt></ruby>がよく<ruby>植<rt>う</rt></ruby>えられました。<ruby>根<rt>ね</rt></ruby>がじょうぶで、<ruby>大<rt>おお</rt></ruby>きな<ruby>木<rt>こ</rt></ruby>かげをつくるからだと<ruby>言<rt>い</rt></ruby>われています。このあたりには、ほかにも<ruby>当時<rt>とうじ</rt></ruby>の<ruby>道<rt>みち</rt></ruby>しるべが<ruby>残<rt>のこ</rt></ruby>っています。',
  aiNoteDetail:
    '塚は本来、道の両側に一基ずつ対で築かれました。明治期以降の道路拡幅で多くが失われ、対で現存する例は全国でも貴重です。史跡指定を受けた塚は、いまも街道歩きの目印として親しまれています。',
  aiNoteDetailRuby:
    '<ruby>塚<rt>つか</rt></ruby>は<ruby>本来<rt>ほんらい</rt></ruby>、<ruby>道<rt>みち</rt></ruby>の<ruby>両側<rt>りょうがわ</rt></ruby>に<ruby>一基<rt>いっき</rt></ruby>ずつ<ruby>対<rt>つい</rt></ruby>で<ruby>築<rt>きず</rt></ruby>かれました。<ruby>明治期<rt>めいじき</rt></ruby><ruby>以降<rt>いこう</rt></ruby>の<ruby>道路拡幅<rt>どうろかくふく</rt></ruby>で<ruby>多<rt>おお</rt></ruby>くが<ruby>失<rt>うしな</rt></ruby>われ、<ruby>対<rt>つい</rt></ruby>で<ruby>現存<rt>げんぞん</rt></ruby>する<ruby>例<rt>れい</rt></ruby>は<ruby>全国<rt>ぜんこく</rt></ruby>でも<ruby>貴重<rt>きちょう</rt></ruby>です。<ruby>史跡指定<rt>しせきしてい</rt></ruby>を<ruby>受<rt>う</rt></ruby>けた<ruby>塚<rt>つか</rt></ruby>は、いまも<ruby>街道歩<rt>かいどうある</rt></ruby>きの<ruby>目印<rt>めじるし</rt></ruby>として<ruby>親<rt>した</rt></ruby>しまれています。',
  partial: false,
  partialChars: null,
  photoLabel: '写真：一里塚跡の石碑',
};

/** 部分読み取りモック */
const MOCK_PARTIAL = {
  id: 'mock-batokannon',
  title: '馬頭観音碑',
  placeName: null,
  lat: null,
  lng: null,
  ocrRaw: '馬頭觀世音 文化八年',
  easyText:
    '「馬頭観音（ばとうかんのん）」と書かれた石碑です。むかし、荷物をはこんで働いた馬をいたわり、旅の安全を願って建てられました。「文化八年」は1811年、今から200年以上前です。',
  easyRuby:
    '「<ruby>馬頭観音<rt>ばとうかんのん</rt></ruby>」と<ruby>書<rt>か</rt></ruby>かれた<ruby>石碑<rt>せきひ</rt></ruby>です。むかし、<ruby>荷物<rt>にもつ</rt></ruby>をはこんで<ruby>働<rt>はたら</rt></ruby>いた<ruby>馬<rt>うま</rt></ruby>をいたわり、<ruby>旅<rt>たび</rt></ruby>の<ruby>安全<rt>あんぜん</rt></ruby>を<ruby>願<rt>ねが</rt></ruby>って<ruby>建<rt>た</rt></ruby>てられました。「<ruby>文化八年<rt>ぶんかはちねん</rt></ruby>」は1811<ruby>年<rt>ねん</rt></ruby>、<ruby>今<rt>いま</rt></ruby>から200<ruby>年以<rt>ねんい</rt></ruby>上<ruby>前<rt>まえ</rt></ruby>です。',
  detailText:
    '馬頭観音は、馬頭明王とも呼ばれ、六道のうち畜生道の救済を司る尊格です。道中の馬の安全と供養を願って建てられた石仏・石碑が街道沿いに多く残ります。銘文「文化八年」は西暦1811年にあたります。',
  detailRuby:
    '<ruby>馬頭観音<rt>ばとうかんのん</rt></ruby>は、<ruby>馬頭明王<rt>ばとうみょうおう</rt></ruby>とも<ruby>呼<rt>よ</rt></ruby>ばれ、<ruby>六道<rt>ろくどう</rt></ruby>のうち<ruby>畜生道<rt>ちくしょうどう</rt></ruby>の<ruby>救済<rt>きゅうさい</rt></ruby>を<ruby>司<rt>つかさど</rt></ruby>る<ruby>尊格<rt>そんかく</rt></ruby>です。<ruby>道中<rt>どうちゅう</rt></ruby>の<ruby>馬<rt>うま</rt></ruby>の<ruby>安全<rt>あんぜん</rt></ruby>と<ruby>供養<rt>くよう</rt></ruby>を<ruby>願<rt>ねが</rt></ruby>って<ruby>建<rt>た</rt></ruby>てられた<ruby>石仏<rt>せきぶつ</rt></ruby>・<ruby>石碑<rt>せきひ</rt></ruby>が<ruby>街道沿<rt>かいどうぞ</rt></ruby>いに<ruby>多<rt>おお</rt></ruby>く<ruby>残<rt>のこ</rt></ruby>ります。<ruby>銘文<rt>めいぶん</rt></ruby>「<ruby>文化八年<rt>ぶんかはちねん</rt></ruby>」は<ruby>西暦<rt>せいれき</rt></ruby>1811<ruby>年<rt>ねん</rt></ruby>にあたります。',
  aiNote:
    '馬頭観音の碑は、街道ぞいや坂道の入り口によく残されています。すり減った文字が多いほど、長く旅人を見守ってきた証かもしれません。',
  aiNoteRuby:
    '<ruby>馬頭観音<rt>ばとうかんのん</rt></ruby>の<ruby>碑<rt>ひ</rt></ruby>は、<ruby>街道<rt>かいどう</rt></ruby>ぞいや<ruby>坂道<rt>さかみち</rt></ruby>の<ruby>入<rt>い</rt></ruby>り<ruby>口<rt>ぐち</rt></ruby>によく<ruby>残<rt>のこ</rt></ruby>されています。すり<ruby>減<rt>へ</rt></ruby>った<ruby>文字<rt>もじ</rt></ruby>が<ruby>多<rt>おお</rt></ruby>いほど、<ruby>長<rt>なが</rt></ruby>く<ruby>旅人<rt>たびびと</rt></ruby>を<ruby>見守<rt>みまも</rt></ruby>ってきた<ruby>証<rt>あかし</rt></ruby>かもしれません。',
  aiNoteDetail:
    '馬頭観音の碑は、街道ぞいや坂道の入り口によく残されています。すり減った文字が多いほど、長く旅人を見守ってきた証かもしれません。',
  aiNoteDetailRuby:
    '<ruby>馬頭観音<rt>ばとうかんのん</rt></ruby>の<ruby>碑<rt>ひ</rt></ruby>は、<ruby>街道<rt>かいどう</rt></ruby>ぞいや<ruby>坂道<rt>さかみち</rt></ruby>の<ruby>入<rt>い</rt></ruby>り<ruby>口<rt>ぐち</rt></ruby>によく<ruby>残<rt>のこ</rt></ruby>されています。すり<ruby>減<rt>へ</rt></ruby>った<ruby>文字<rt>もじ</rt></ruby>が<ruby>多<rt>おお</rt></ruby>いほど、<ruby>長<rt>なが</rt></ruby>く<ruby>旅人<rt>たびびと</rt></ruby>を<ruby>見守<rt>みまも</rt></ruby>ってきた<ruby>証<rt>あかし</rt></ruby>かもしれません。',
  partial: true,
  partialChars: '馬頭觀世音 ／ 文化八年',
  photoLabel: '写真：風化した石碑',
};

/**
 * 初期シード用の履歴サンプル（localStorage が空のときのみ投入）
 * ユーザーがデータ削除したあとは再投入しない（seeded フラグで制御）
 */
const SEED_RECORDS = [
  {
    id: 'seed-1',
    title: '旧東海道 一里塚跡',
    placeName: '神奈川県藤沢市',
    lat: 35.3389,
    lng: 139.4871,
    easyText: MOCK_SUCCESS.easyText,
    easyRuby: MOCK_SUCCESS.easyRuby,
    detailText: MOCK_SUCCESS.detailText,
    detailRuby: MOCK_SUCCESS.detailRuby,
    aiNote: MOCK_SUCCESS.aiNote,
    aiNoteRuby: MOCK_SUCCESS.aiNoteRuby,
    aiNoteDetail: MOCK_SUCCESS.aiNoteDetail,
    aiNoteDetailRuby: MOCK_SUCCESS.aiNoteDetailRuby,
    ocrRaw: MOCK_SUCCESS.ocrRaw,
    partial: false,
    partialChars: null,
    memo: '子どもと来た。榎はどれ？',
    photoLabel: '写真：一里塚跡の石碑',
    photoDataUrl: null,
    createdAt: '2026-07-18T14:22:00',
  },
  {
    id: 'seed-2',
    title: '道祖神',
    placeName: '神奈川県大磯町',
    lat: 35.3067,
    lng: 139.3156,
    easyText:
      '道祖神は、村の入り口などに置かれた石の神さまです。旅人の安全や、村を守ることを願ってまつられました。夫婦の形で彫られているものも多く見られます。',
    easyRuby:
      '<ruby>道祖神<rt>どうそじん</rt></ruby>は、<ruby>村<rt>むら</rt></ruby>の<ruby>入<rt>い</rt></ruby>り<ruby>口<rt>ぐち</rt></ruby>などに<ruby>置<rt>お</rt></ruby>かれた<ruby>石<rt>いし</rt></ruby>の<ruby>神<rt>かみ</rt></ruby>さまです。<ruby>旅人<rt>たびびと</rt></ruby>の<ruby>安全<rt>あんぜん</rt></ruby>や、<ruby>村<rt>むら</rt></ruby>を<ruby>守<rt>まも</rt></ruby>ることを<ruby>願<rt>ねが</rt></ruby>ってまつられました。<ruby>夫婦<rt>ふうふ</rt></ruby>の<ruby>形<rt>かたち</rt></ruby>で<ruby>彫<rt>ほ</rt></ruby>られているものも<ruby>多<rt>おお</rt></ruby>く<ruby>見<rt>み</rt></ruby>られます。',
    detailText:
      '道祖神は塞の神・岐の神とも称され、境界を守護する民間信仰の対象です。双体道祖神は関東・中部地方に多く、夫婦和合や子孫繁栄の祈願とも結びついています。',
    detailRuby:
      '<ruby>道祖神<rt>どうそじん</rt></ruby>は<ruby>塞<rt>さえ</rt></ruby>の<ruby>神<rt>かみ</rt></ruby>・<ruby>岐<rt>くなど</rt></ruby>の<ruby>神<rt>かみ</rt></ruby>とも<ruby>称<rt>しょう</rt></ruby>され、<ruby>境界<rt>きょうかい</rt></ruby>を<ruby>守護<rt>しゅご</rt></ruby>する<ruby>民間信仰<rt>みんかんしんこう</rt></ruby>の<ruby>対象<rt>たいしょう</rt></ruby>です。<ruby>双体道祖神<rt>そうたいどうそじん</rt></ruby>は<ruby>関東<rt>かんとう</rt></ruby>・<ruby>中部地方<rt>ちゅうぶちほう</rt></ruby>に<ruby>多<rt>おお</rt></ruby>く、<ruby>夫婦和合<rt>ふうふわごう</rt></ruby>や<ruby>子孫繁栄<rt>しそんはんえい</rt></ruby>の<ruby>祈願<rt>きがん</rt></ruby>とも結びついています。',
    aiNote:
      '大磯周辺は旧東海道の宿場町で、いまも道端に小さな道祖神が点在しています。',
    aiNoteRuby:
      '<ruby>大磯<rt>おおいそ</rt></ruby><ruby>周辺<rt>しゅうへん</rt></ruby>は<ruby>旧東海道<rt>きゅうとうかいどう</rt></ruby>の<ruby>宿場町<rt>しゅくばまち</rt></ruby>で、いまも<ruby>道端<rt>みちばた</rt></ruby>に小さな<ruby>道祖神<rt>どうそじん</rt></ruby>が<ruby>点在<rt>てんざい</rt></ruby>しています。',
    aiNoteDetail:
      '大磯周辺は旧東海道の宿場町で、いまも道端に小さな道祖神が点在しています。',
    aiNoteDetailRuby:
      '<ruby>大磯<rt>おおいそ</rt></ruby><ruby>周辺<rt>しゅうへん</rt></ruby>は<ruby>旧東海道<rt>きゅうとうかいどう</rt></ruby>の<ruby>宿場町<rt>しゅくばまち</rt></ruby>で、いまも<ruby>道端<rt>みちばた</rt></ruby>に小さな<ruby>道祖神<rt>どうそじん</rt></ruby>が<ruby>点在<rt>てんざい</rt></ruby>しています。',
    ocrRaw: '道祖神',
    partial: false,
    partialChars: null,
    memo: '',
    photoLabel: '写真：道祖神',
    photoDataUrl: null,
    createdAt: '2026-07-12T11:05:00',
  },
  {
    id: 'seed-3',
    title: '二宮尊徳 生家の碑',
    placeName: '神奈川県小田原市',
    lat: 35.2644,
    lng: 139.1521,
    easyText:
      '二宮尊徳（金次郎）は、むかしの小田原の近くで生まれた人です。苦しい暮らしの中でも学び、村を元気にする方法を考えました。この碑は、その生まれた場所をしるしています。',
    easyRuby:
      '<ruby>二宮尊徳<rt>にのみやそんとく</rt></ruby>（<ruby>金次郎<rt>きんじろう</rt></ruby>）は、むかしの<ruby>小田原<rt>おだわら</rt></ruby>の<ruby>近<rt>ちか</rt></ruby>くで<ruby>生<rt>う</rt></ruby>まれた<ruby>人<rt>ひと</rt></ruby>です。<ruby>苦<rt>くる</rt></ruby>しい<ruby>暮<rt>く</rt></ruby>らしの<ruby>中<rt>なか</rt></ruby>でも<ruby>学<rt>まな</rt></ruby>び、<ruby>村<rt>むら</rt></ruby>を<ruby>元気<rt>げんき</rt></ruby>にする<ruby>方法<rt>ほうほう</rt></ruby>を<ruby>考<rt>かんが</rt></ruby>えました。この<ruby>碑<rt>ひ</rt></ruby>は、その<ruby>生<rt>う</rt></ruby>まれた<ruby>場所<rt>ばしょ</rt></ruby>をしるしています。',
    detailText:
      '二宮尊徳（1787–1856）は報徳思想を唱え、荒廃した農村の復興に尽力した経世家です。報徳仕法は分度・推譲を核とし、のちの学校教育や農村政策にも影響を与えました。',
    detailRuby:
      '<ruby>二宮尊徳<rt>にのみやそんとく</rt></ruby>（1787–1856）は<ruby>報徳思想<rt>ほうとくしそう</rt></ruby>を<ruby>唱<rt>とな</rt></ruby>え、<ruby>荒廃<rt>こうはい</rt></ruby>した<ruby>農村<rt>のうそん</rt></ruby>の<ruby>復興<rt>ふっこう</rt></ruby>に<ruby>尽力<rt>じんりょく</rt></ruby>した<ruby>経世家<rt>けいせいか</rt></ruby>です。<ruby>報徳仕法<rt>ほうとくしほう</rt></ruby>は<ruby>分度<rt>ぶんど</rt></ruby>・<ruby>推譲<rt>すいじょう</rt></ruby>を<ruby>核<rt>かく</rt></ruby>とし、のちの<ruby>学校教育<rt>がっこうきょういく</rt></ruby>や<ruby>農村政策<rt>のうそんせいさく</rt></ruby>にも<ruby>影響<rt>えいきょう</rt></ruby>を<ruby>与<rt>あた</rt></ruby>えました。',
    aiNote:
      '薪を背負って本を読む金次郎像は、勤勉の象徴として全国の学校に置かれました。',
    aiNoteRuby:
      '<ruby>薪<rt>たきぎ</rt></ruby>を<ruby>背負<rt>せお</rt></ruby>って<ruby>本<rt>ほん</rt></ruby>を<ruby>読<rt>よ</rt></ruby>む<ruby>金次郎像<rt>きんじろうぞう</rt></ruby>は、<ruby>勤勉<rt>きんべん</rt></ruby>の<ruby>象徴<rt>しょうちょう</rt></ruby>として<ruby>全国<rt>ぜんこく</rt></ruby>の<ruby>学校<rt>がっこう</rt></ruby>に<ruby>置<rt>お</rt></ruby>かれました。',
    aiNoteDetail:
      '薪を背負って本を読む金次郎像は、勤勉の象徴として全国の学校に置かれました。',
    aiNoteDetailRuby:
      '<ruby>薪<rt>たきぎ</rt></ruby>を<ruby>背負<rt>せお</rt></ruby>って<ruby>本<rt>ほん</rt></ruby>を<ruby>読<rt>よ</rt></ruby>む<ruby>金次郎像<rt>きんじろうぞう</rt></ruby>は、<ruby>勤勉<rt>きんべん</rt></ruby>の<ruby>象徴<rt>しょうちょう</rt></ruby>として<ruby>全国<rt>ぜんこく</rt></ruby>の<ruby>学校<rt>がっこう</rt></ruby>に<ruby>置<rt>お</rt></ruby>かれました。',
    ocrRaw: '二宮尊徳先生生誕之地',
    partial: false,
    partialChars: null,
    memo: '報徳博物館にも寄った',
    photoLabel: '写真：二宮尊徳 生家の碑',
    photoDataUrl: null,
    createdAt: '2026-06-29T15:40:00',
  },
  {
    id: 'seed-4',
    title: '大山道 道標',
    placeName: '神奈川県伊勢原市',
    lat: 35.3975,
    lng: 139.3142,
    easyText:
      '大山へ向かう道しるべの石です。むかし、多くの人が大山詣でに出かけ、このあたりを通って山へ向かいました。',
    easyRuby:
      '<ruby>大山<rt>おおやま</rt></ruby>へ<ruby>向<rt>む</rt></ruby>かう<ruby>道<rt>みち</rt></ruby>しるべの<ruby>石<rt>いし</rt></ruby>です。むかし、<ruby>多<rt>おお</rt></ruby>くの<ruby>人<rt>ひと</rt></ruby>が<ruby>大山詣<rt>おおやまもう</rt></ruby>でに<ruby>出<rt>で</rt></ruby>かけ、このあたりを<ruby>通<rt>とお</rt></ruby>って<ruby>山<rt>やま</rt></ruby>へ<ruby>向<rt>む</rt></ruby>かいました。',
    detailText:
      '大山道は、江戸や相模の各地から大山阿夫利神社へ通じる参詣道の総称です。道標は距離や方角を示し、講中の寄進によって建てられたものが多く残ります。',
    detailRuby:
      '<ruby>大山道<rt>おおやまみち</rt></ruby>は、<ruby>江戸<rt>えど</rt></ruby>や<ruby>相模<rt>さがみ</rt></ruby>の<ruby>各地<rt>かくち</rt></ruby>から<ruby>大山阿夫利神社<rt>おおやまあふりじんじゃ</rt></ruby>へ<ruby>通<rt>つう</rt></ruby>じる<ruby>参詣道<rt>さんけいみち</rt></ruby>の<ruby>総称<rt>そうしょう</rt></ruby>です。<ruby>道標<rt>どうひょう</rt></ruby>は<ruby>距離<rt>きょり</rt></ruby>や<ruby>方角<rt>ほうがく</rt></ruby>を<ruby>示<rt>しめ</rt></ruby>し、<ruby>講中<rt>こうじゅう</rt></ruby>の<ruby>寄進<rt>きしん</rt></ruby>によって<ruby>建<rt>た</rt></ruby>てられたものが<ruby>多<rt>おお</rt></ruby>く<ruby>残<rt>のこ</rt></ruby>ります。',
    aiNote: '大山詣では江戸庶民の人気レジャーでもあり、「大山は江戸の鬼門除け」とも言われました。',
    aiNoteRuby:
      '<ruby>大山詣<rt>おおやまもう</rt></ruby>では<ruby>江戸庶民<rt>えどしょみん</rt></ruby>の<ruby>人気<rt>にんき</rt></ruby>レジャーでもあり、「<ruby>大山<rt>おおやま</rt></ruby>は<ruby>江戸<rt>えど</rt></ruby>の<ruby>鬼門除<rt>きもんよ</rt></ruby>け」とも<ruby>言<rt>い</rt></ruby>われました。',
    aiNoteDetail:
      '大山詣では江戸庶民の人気レジャーでもあり、「大山は江戸の鬼門除け」とも言われました。',
    aiNoteDetailRuby:
      '<ruby>大山詣<rt>おおやまもう</rt></ruby>では<ruby>江戸庶民<rt>えどしょみん</rt></ruby>の<ruby>人気<rt>にんき</rt></ruby>レジャーでもあり、「<ruby>大山<rt>おおやま</rt></ruby>は<ruby>江戸<rt>えど</rt></ruby>の<ruby>鬼門除<rt>きもんよ</rt></ruby>け」とも<ruby>言<rt>い</rt></ruby>われました。',
    ocrRaw: '右 大山道',
    partial: false,
    partialChars: null,
    memo: '',
    photoLabel: '写真：大山道 道標',
    photoDataUrl: null,
    createdAt: '2026-06-21T10:15:00',
  },
];

const DEFAULT_SETTINGS = {
  furiganaDefault: true,
  modeDefault: 'easy', // 'easy' | 'detail'
  geoEnabled: true,
};

const STORAGE_SEEDED = 'toruhodo.seeded';

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_SETTINGS);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings) {
  localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(settings));
}

function loadRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_RECORDS);
    if (raw) return JSON.parse(raw);
    // 初回のみシード
    if (!localStorage.getItem(STORAGE_SEEDED)) {
      localStorage.setItem(STORAGE_RECORDS, JSON.stringify(SEED_RECORDS));
      localStorage.setItem(STORAGE_SEEDED, '1');
      return [...SEED_RECORDS];
    }
    return [];
  } catch {
    return [];
  }
}

function saveRecords(records) {
  localStorage.setItem(STORAGE_RECORDS, JSON.stringify(records));
}

function clearAllData() {
  localStorage.setItem(STORAGE_RECORDS, JSON.stringify([]));
  localStorage.setItem(STORAGE_SEEDED, '1');
  saveSettings({ ...DEFAULT_SETTINGS });
}

function uid() {
  return 'r_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function formatDateJa(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function formatDateTimeJa(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getMonth() + 1}月${d.getDate()}日 ${hh}:${mm}`;
}

/** thumb ストライプのバリエーション */
function thumbStyle(index) {
  const palettes = [
    ['#E7DFC8', '#EFE8D4'],
    ['#E2DAC4', '#EAE2CE'],
    ['#DFD7C0', '#E8E0CB'],
    ['#E5DCC2', '#EDE5D0'],
  ];
  const [a, b] = palettes[index % palettes.length];
  return `repeating-linear-gradient(45deg, ${a} 0 12px, ${b} 12px 24px)`;
}
