const jimp = require('jimp');

const proto = jimp.Jimp ? jimp.Jimp.prototype : {};
const protoKeys = Object.getOwnPropertyNames(proto);

const statics = jimp.Jimp ? Object.keys(jimp.Jimp) : [];

console.log(JSON.stringify({
    stats: statics,
    proto: protoKeys.filter(k => k === 'print' || k === 'write' || k === 'read'),
    topLevelFonts: Object.keys(jimp).filter(k => k.includes('FONT') || k.includes('font'))
}, null, 2));
