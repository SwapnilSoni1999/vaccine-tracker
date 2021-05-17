const { spawn } = require('child_process')
const fs = require('fs')

exports.solveCaptcha = (svgCode, chatId) => {
    return new Promise((resolve, reject) => {
        const filename = `captcha_${chatId}.svg`
        fs.writeFileSync(filename, svgCode)
        let dataToSend = ''
        const process = spawn('python3', ["captcha.py", `./${filename}`])
        process.stdout.on('data', (chunk) => {
            dataToSend += Buffer.from(chunk).toString()
        })

        process.stdout.on('end', () => {
            fs.unlinkSync(filename)
            resolve(dataToSend.trim())
        })
    })
}
