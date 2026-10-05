
function calibrateFace(r) {
    if (r < 0.50) return r * 1.5;
    return Math.min(1.0, 0.75 + ((r - 0.50) / 0.50) * 0.25);
}
function calibrateVoice(r) {
    if (r < 0.40) return r * 1.875;
    return Math.min(1.0, 0.75 + ((r - 0.40) / 0.40) * 0.25);
}
function fuse(f, v) {
    let fCal = calibrateFace(f);
    let vCal = calibrateVoice(v);
    return (0.6 * fCal) + (0.4 * vCal);
}

const faceRaw = [0.3, 0.4, 0.49, 0.50, 0.6, 0.75, 0.9, 1.0];
console.log('FACE:');
faceRaw.forEach(r => console.log('Raw: ' + r.toFixed(2) + ' -> Cal: ' + calibrateFace(r).toFixed(4)));

const voiceRaw = [0.2, 0.3, 0.39, 0.40, 0.5, 0.65, 0.8, 1.0];
console.log('\nVOICE:');
voiceRaw.forEach(r => console.log('Raw: ' + r.toFixed(2) + ' -> Cal: ' + calibrateVoice(r).toFixed(4)));

console.log('\nFUSION:');
console.log('Good Face (0.9), Minimum Voice (0.40): ' + fuse(0.9, 0.40).toFixed(4) + ' (Expected >= 0.75)');
console.log('Excellent Face (0.95), Good Voice (0.65): ' + fuse(0.95, 0.65).toFixed(4) + ' (Expected >= 0.85)');
console.log('Minimum Face (0.50), Minimum Voice (0.40): ' + fuse(0.50, 0.40).toFixed(4) + ' (Expected >= 0.75)');

