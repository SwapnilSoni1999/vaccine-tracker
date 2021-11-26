//unused file
const crypto = require('crypto')

//https://github.com/brix/crypto-js/issues/274
function CryptJsWordArrayToUint8Array(wordArray) {
    const l = wordArray.sigBytes;
    const words = wordArray.words;
    const result = new Uint8Array(l);
    var i=0 /*dst*/, j=0 /*src*/;
    while(true) {
        // here i is a multiple of 4
        if (i==l)
            break;
        var w = words[j++];
        result[i++] = (w & 0xff000000) >>> 24;
        if (i==l)
            break;
        result[i++] = (w & 0x00ff0000) >>> 16;
        if (i==l)
            break;
        result[i++] = (w & 0x0000ff00) >>> 8;
        if (i==l)
            break;
        result[i++] = (w & 0x000000ff);
    }
    return result;
}

// https://stackoverflow.com/questions/8936984/uint8array-to-string-in-javascript
function Utf8ArrayToStr(array) {
    var out, i, len, c;
    var char2, char3;

    out = "";
    len = array.length;
    i = 0;
    while(i < len) {
    c = array[i++];
    switch(c >> 4)
    {
      case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7:
        // 0xxxxxxx
        out += String.fromCharCode(c);
        break;
      case 12: case 13:
        // 110x xxxx   10xx xxxx
        char2 = array[i++];
        out += String.fromCharCode(((c & 0x1F) << 6) | (char2 & 0x3F));
        break;
      case 14:
        // 1110 xxxx  10xx xxxx  10xx xxxx
        char2 = array[i++];
        char3 = array[i++];
        out += String.fromCharCode(((c & 0x0F) << 12) |
                       ((char2 & 0x3F) << 6) |
                       ((char3 & 0x3F) << 0));
        break;
    }
    }

    return out;
}

// const iv = CryptJsWordArrayToUint8Array({ words: [1711175350, -1288971959, 168809783, 1640795245], sigBytes: 16 })

const iv = { words: [1711175350, -1288971959, 168809783, 1640795245], sigBytes: 16 }

exports.AESencrypt = (data, key) => {
    const cipher = crypto.createCipheriv('aes-128-ctr', key, iv)
    const encrypted = Buffer.concat([
        cipher.update(data, 'utf8'),
        cipher.final()
    ])
    return encrypted.toString('base64')
}

exports.AESdecrypt = (data, key) => {
    const decipher = crypto.createDecipheriv('aes-128-ctr', key, iv)
    const decrypted = Buffer.concat([
        decipher.update(data, 'base64'),
        decipher.final()
    ])
    return decrypted.toString('utf8')
}

exports.sha256 = (data) => {
    return crypto.createHash('sha256').update(data).digest('base64')
}
