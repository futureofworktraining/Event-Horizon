const Jimp = require('jimp');

// Check if Jimp (default export) has static constants
console.log('Jimp (default) FONT_SANS_32_WHITE:', !!Jimp.FONT_SANS_32_WHITE);
console.log('Jimp (default) loadFont:', !!Jimp.loadFont);

// Check if Jimp is a class and has print on prototype
if (Jimp.prototype) {
    console.log('Jimp (default) prototype keys:', Object.getOwnPropertyNames(Jimp.prototype));
} else {
    // Maybe it's a factory function?
    console.log('Jimp (default) is not a class? Type:', typeof Jimp);
}

// Check named export Jimp explicitly
const { Jimp: JimpNamed } = require('jimp');
if (JimpNamed) {
    console.log('Jimp (named) prototype keys:', Object.getOwnPropertyNames(JimpNamed.prototype));
}
