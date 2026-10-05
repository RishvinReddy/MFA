import { fuzzyPhraseMatch } from './src/utils/similarity';

const tests = [
  'blue river',
  'Blue River',
  'blue  river',
  'blue rivers',
  'blue rider',
  'blue',
  'river',
  'blue river please'
];

for(const t of tests) {
  console.log(t + ' : ' + fuzzyPhraseMatch('blue river', t));
}
