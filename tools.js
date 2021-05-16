const sharp = require('sharp')
const fs = require('fs')
const { default: axios } = require('axios')

exports.svgToPng = (svgCode, chatId) => {
    return new Promise((resolve, reject) => {
        const svgFile = `captcha_${chatId}.svg`
        const pngFile = `captcha_${chatId}.png`
        fs.writeFileSync(svgFile, svgCode.toString())
        sharp(svgFile).png().flatten({ background: { r: 255, g: 255, b: 255 } }).toFile(pngFile).then(() => {
            fs.unlinkSync(svgFile)
            resolve({ filename: pngFile })
        })
    })
}

exports.solveCaptcha = async (image_data) => {
    const headers = {
        'authority': 'api.apitruecaptcha.org',
        'pragma': 'no-cache',
        'cache-control': 'no-cache',
        'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36',
        'content-type': 'text/plain;charset=UTF-8',
        'accept': '*/*',
        'origin': 'https://apitruecaptcha.org',
        'sec-fetch-site': 'same-site',
        'sec-fetch-mode': 'cors',
        'sec-fetch-dest': 'empty',
        'referer': 'https://apitruecaptcha.org/',
        'accept-language': 'en-US,en-IN;q=0.9,en;q=0.8',
    }

    const jsonData = JSON.parse(fs.readFileSync('captcha.json'))
    jsonData.data = image_data
    const res = await axios({
        method: 'POST',
        url: 'https://api.apitruecaptcha.org/one/gettext',
        data: jsonData,
        headers
    })
    return res.data.result
}
