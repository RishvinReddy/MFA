import { fuzzyPhraseMatch } from './src/utils/similarity';

const target = "secure access";
const tests = {
    "Exact": "secure access",
    "Case variation": "Secure Access",
    "Whitespace": "secure  access",
    "Filler": "um secure access please",
    "Partial 1": "secure",
    "Partial 2": "access",
    "Thank you": "thank you and access",
    "Reordered": "access secure",
    "Substitution 1": "secure address",
    "Substitution 2": "secret access",
    "Completely different": "open the vault",
    "Extra word inside": "secure biometric access"
};

console.log("| Expected | Actual | Result |");
console.log("|---|---|---|");
for (const [key, val] of Object.entries(tests)) {
    const res = fuzzyPhraseMatch(target, val);
    console.log(`| ${target} | ${val} | ${res ? 'PASS' : 'FAIL'} |`);
}
