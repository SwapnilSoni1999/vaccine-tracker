const { default: axios } = require('axios')
const crypto = require('crypto')

const secretKey = "b5cab167-7977-4df1-8027-a63aa144f04e"
const AES_KEY = "CoWIN@$#&*(!@%^&"

const headers = {
    'authority': 'cdn-api.co-vin.in',
    'cache-control': 'max-age=0',
    'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="90", "Google Chrome";v="90"',
    'sec-ch-ua-mobile': '?0',
    'upgrade-insecure-requests': '1',
    'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36',
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
    'sec-fetch-site': 'none',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-user': '?1',
    'sec-fetch-dest': 'document',
    'accept-language': 'en-US,en-IN;q=0.9,en;q=0.8',
    'if-none-match': 'W/"14c7-xM9aYt9EVsqHGvfnQctm12OVYZE"',
}

const proxies = [
    { ip: '209.127.191.180', port: '9279' },
    { ip: '45.95.96.132', port: '8691' },
    { ip: '45.95.96.187', port: '8746' },
    { ip: '45.95.96.237', port: '8796' },
    { ip: '45.136.228.154', port: '6209' },
    { ip: '45.94.47.66', port: '8110' },
    { ip: '45.94.47.108', port: '8152' },
    { ip: '193.8.56.119', port: '9183' },
    { ip: '45.95.99.226', port: '7786' },
    { ip: '45.95.99.20', port: '7580' }
]

const sha256 = (data) => {
    return crypto.createHash('sha256').update(data).digest('hex')
}

const verifyOtp = async (otp, txnId) => {
    try {
        const res = await axios({
            method: 'POST',
            url: 'https://cdn-api.co-vin.in/api/v2/auth/validateMobileOtp',
            data: {
                otp: sha256(otp),
                txnId: txnId
            },
            headers
        })
        console.log(res.data)
        // this.token = res.data.token
        return res.data.token
    } catch(err) {
        console.log(err)
        throw new Error('Invalid otp!')
    }
}

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(() => resolve(), ms)
    })
}

const _getBeneficiaries = async (token) => {
    const res = await axios({
        method: 'GET',
        url: 'https://cdn-api.co-vin.in/api/v2/appointment/beneficiaries',
        headers: {
            ...headers,
            authorization: 'Bearer ' + token
        }
    })
    console.log(res.data)
    return res.data.beneficiaries
}

const getToday = () => {
    const dateObj = new Date()
    return `${String(dateObj.getDate()).padStart(2, '0')}-${String(dateObj.getMonth()+1).padStart(2, '0')}-${dateObj.getFullYear()}`
}

class CoWIN {
    constructor(mobileNumber) {
        if (!mobileNumber) {
            throw new Error(`mobileNumber is required!`)
        }
        this.mobile = mobileNumber
        // return await this.sendOtp(mobileNumber)
    }
    async sendOtp() {
        const postData = {
            mobile: this.mobile,
            secret: "U2FsdGVkX19at5EJPMYRe6TTDK4WWA2Nyb6b6c+QAmcYQjuhurrk6+CUqmMKHtSeaETDAIuXC+7Jz+ioZvkG+Q=="
        }
        const res = await axios({
            method: 'POST',
            url: 'https://cdn-api.co-vin.in/api/v2/auth/generateMobileOTP',
            data: postData,
            headers
        })
        console.log(res.data)
        this.txnId = res.data.txnId
        return this.txnId
    }

    static async verifyOtpStatic(otp, txnId) {
        return verifyOtp(otp, txnId)
    }

    async verifyOtp(otp, txnId=null) {
        this.token = await verifyOtp(otp, txnId || this.txnId)
        return this.token
    }

    async getBeneficiaries() {
        return _getBeneficiaries(this.token)
    }

    static async getBeneficiariesStatic(token) {
        return _getBeneficiaries(token)
    }

    static async getStates() {
        const res = await axios({
            method: 'GET',
            url: 'https://cdn-api.co-vin.in/api/v2/admin/location/states',
            headers
        })
        return res.data.states
    }

    static async getDistrict(id) {
        const res = await axios({
            method: 'GET',
            url: 'https://cdn-api.co-vin.in/api/v2/admin/location/districts/' + id,
            headers
        })
        return res.data.districts
    }

    static async getCenters(pincode, vaccine=null) {
        let params = {
            pincode,
            date: getToday()
        }
        if (vaccine) {
            params.vaccine = vaccine
        }
        console.log(params)
        try {
            const random = Math.floor(Math.random() * proxies.length)
            const { ip, port } = proxies[random]
            const res = await axios({
                method: 'GET',
                url: 'https://cdn-api.co-vin.in/api/v2/appointment/sessions/public/calendarByPin',
                params: params,
                headers,
                // proxy: {
                //     host: ip,
                //     port: port,
                //     auth: {
                //         username: 'yygtpiqz-dest',
                //         password: 'mu2j2xtfubbw'
                //     }
                // }
            })
            return res.data.centers
        } catch (err) {
            console.log(err)
            // if (err.response.status == 403) {
            //     console.log("Rate limit exceeded! Waiting for 10 minutes...")
            //     await sleep(10* 60 * 1000)
            //     // trackerHandler = setInterval(trackAndInform, 500 * 1000)
            //     // return this.getCenters(pincode, vaccine)
            // }
            const centers = []
            return centers
        }
    }
}

module.exports = CoWIN