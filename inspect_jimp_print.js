try {
    const fonts = require('jimp/fonts');
    console.log('jimp/fonts exports:', Object.keys(fonts));
} catch (e) {
    console.log('Error requiring jimp/fonts:', e.message);
}

const { Jimp } = require('jimp');
if (Jimp) {
    // Manually read image using Jimp.read if possible to get an instance
    // But we don't have an image.
    // Let's create a new Jimp if constructor allows
    try {
        const img = new Jimp({ width: 100, height: 100 });
        if (img.print) {
            console.log('image.print function:', img.print.toString());
            console.log('image.print length:', img.print.length);
        } else {
            console.log('image.print is undefined on new Jimp() instance');
            // Maybe it's not loaded?
            // plugins need to be loaded?
        }
    } catch (e) {
        console.log('Error creating Jimp instance:', e.message);
    }
}
