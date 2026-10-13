export type Lang = 'en' | 'hi';

const en = {
  'start.title': 'See jewelry on you',
  'start.sub': 'Try earrings and necklaces in seconds',
  'start.cta': 'Touch to start',
  'notice.title': 'Camera in use',
  'notice.body':
    "Your video stays on this screen. It is not recorded or uploaded. We don't identify you. Photos are saved only if you choose, and deleted after {h} hours. For adults, or children with a parent or guardian.",
  'notice.terms': 'Terms and privacy: scan on your phone',
  'notice.accept': 'Accept',
  'notice.decline': 'No thanks',
  'pick.home': '← Home',
  'pick.title': 'Choose your jewellery',
  'pick.hint': 'Tap a piece to try it on',
  'pick.soon': 'More coming soon',
  'cat.earrings': 'Earrings',
  'cat.necklace': 'Necklaces',
  'live.guide': 'Look at the camera',
  'live.details': 'Details',
  'live.starting': 'Starting camera…',
  'hint.noface': 'Look at the camera and step a little closer',
  'hint.multi': "We're tracking the closest person",
  'hint.dark': "It's a bit dark. Face the light.",
  'photo.question': 'Save this photo and get a link on your phone?',
  'photo.expiry': 'Deleted after {h} hours',
  'photo.save': 'Save',
  'photo.retake': 'Retake',
  'photo.discard': "Don't save",
  'qr.title': 'Scan to get your photo',
  'qr.help': 'Open your phone camera and point it at the code. Link works for {h} hours.',
  'qr.done': 'Done',
  'qr.auto': 'Auto-closing in {s} s',
  'idle.title': 'Still there?',
  'idle.body': 'Returning to start in {s} s',
  'idle.continue': "I'm here",
  'result.disclaimer': 'Results are approximate. Real pieces may differ.',
  'details.back': 'Back to try-on',
  'details.tryon': 'Try it on',
  'details.next': 'Next',
  'err.camera': "Camera isn't available. Please ask staff for help.",
  'err.save': "Can't save right now. Check the connection or try again.",
  'err.catalog': 'Jewelry is unavailable. Please ask staff.',
  'err.retry': 'Retry',
  'err.ok': 'OK',
} as const;

export type Key = keyof typeof en;

const hi: Record<Key, string> = {
  'start.title': 'गहने खुद पर देखें',
  'start.sub': 'कुछ ही सेकंड में झुमके और हार पहनकर देखें',
  'start.cta': 'शुरू करने के लिए छुएँ',
  'notice.title': 'कैमरा चालू है',
  'notice.body':
    'आपका वीडियो इसी स्क्रीन पर रहता है। इसे रिकॉर्ड या अपलोड नहीं किया जाता। हम आपकी पहचान नहीं करते। फ़ोटो तभी सहेजी जाती है जब आप चाहें, और {h} घंटे बाद हटा दी जाती है। वयस्कों के लिए, या अभिभावक के साथ बच्चों के लिए।',
  'notice.terms': 'नियम और गोपनीयता: अपने फ़ोन से स्कैन करें',
  'notice.accept': 'स्वीकार करें',
  'notice.decline': 'नहीं, धन्यवाद',
  'pick.home': '← होम',
  'pick.title': 'अपना गहना चुनें',
  'pick.hint': 'पहनकर देखने के लिए गहने को छुएँ',
  'pick.soon': 'जल्द ही और आ रहे हैं',
  'cat.earrings': 'झुमके',
  'cat.necklace': 'हार',
  'live.guide': 'कैमरे की ओर देखें',
  'live.details': 'विवरण',
  'live.starting': 'कैमरा शुरू हो रहा है…',
  'hint.noface': 'कैमरे की ओर देखें और थोड़ा पास आएँ',
  'hint.multi': 'हम सबसे पास वाले व्यक्ति को ट्रैक कर रहे हैं',
  'hint.dark': 'थोड़ा अंधेरा है। रोशनी की ओर मुँह करें।',
  'photo.question': 'यह फ़ोटो सहेजें और फ़ोन पर लिंक पाएँ?',
  'photo.expiry': '{h} घंटे बाद हटा दी जाएगी',
  'photo.save': 'सहेजें',
  'photo.retake': 'दोबारा लें',
  'photo.discard': 'सहेजें नहीं',
  'qr.title': 'अपनी फ़ोटो पाने के लिए स्कैन करें',
  'qr.help': 'फ़ोन का कैमरा खोलें और कोड की ओर करें। लिंक {h} घंटे चलेगा।',
  'qr.done': 'हो गया',
  'qr.auto': '{s} सेकंड में बंद होगा',
  'idle.title': 'क्या आप वहीं हैं?',
  'idle.body': '{s} सेकंड में शुरुआत पर लौटेंगे',
  'idle.continue': 'मैं यहाँ हूँ',
  'result.disclaimer': 'नतीजे अनुमानित हैं। असली गहने अलग दिख सकते हैं।',
  'details.back': 'वापस ट्राई-ऑन पर',
  'details.tryon': 'पहनकर देखें',
  'details.next': 'आगे',
  'err.camera': 'कैमरा उपलब्ध नहीं है। कृपया स्टाफ़ से मदद लें।',
  'err.save': 'अभी सहेज नहीं सकते। कनेक्शन जाँचें या फिर कोशिश करें।',
  'err.catalog': 'गहने उपलब्ध नहीं हैं। कृपया स्टाफ़ से पूछें।',
  'err.retry': 'फिर कोशिश करें',
  'err.ok': 'ठीक है',
};

let lang: Lang = 'en';
export const getLang = () => lang;
export const setLang = (l: Lang) => {
  lang = l;
};
export function t(key: Key, vars: Record<string, string | number> = {}): string {
  const s = (lang === 'hi' ? hi : en)[key];
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}
