const express = require('express')
const path = require('path')
const fs = require('fs');
const crypto = require('crypto')
const axios = require('axios')
const { spawn, exec } = require('child_process');
const { stdout, stderr } = require('process');
const app = express()
const port = 3001

const loginPath = path.join(__dirname, 'logins')
const serverServiceName = 'rever'

const logins = []
const admins = {}
const tokens = {}

const checkAuthing = ({ username, password }) => {
    for ( let i = 0 ; i < logins.length ; i++ )
        if (logins[i].username === username && logins[i].password === password)
            return {lvl: admins[username]}
        else
            continue
    return false
}

fs.readdir(loginPath, function (err, files) {
    if (err) {
        return console.log('Unable to scan directory: ' + err);
    } 
    files.forEach(function (file) {
        const abs_file = path.join(loginPath, file)
        fs.readFile(abs_file, 'utf8' , (err, data) => {
            if (err) {
                console.error(err)
                return
            }
            const [ u , p, g ] = data.split(';')
            logins.push({username: u, password: p})
            admins[u] = parseInt(g)
        })
    });
})

let serverFailLogPath = '/logs/server-fails.log'
let timeout = 3000
let errorCodes = [503, 502]
let intervalMonitor = 2000
let stopMonitor = false
let restartRetries = 0
let restartNumRestart = 3
let timerMonitor = setTimeout(()=>{}, 100)

let stopEngineCheck = false
let intervalEngineCheck = 5000
let timerEngine = setTimeout(()=>{}, 100)
let retriesEngine = 0
let engineNumReset = 3

let stopServiceCheck = false
let intervalServiceCheck = 5000
let timerService = setTimeout(()=>{}, 100)
let retriesService = 0
let serviceNumReset = 3

const globalURL = `http://raverdating.com`
const localURL = `http://127.0.0.1:3000`

const checkEngine = (port) => {
    clearTimeout(timerEngine)
    if (stopEngineCheck) return
    axios({
        method: 'get',
        url: `${globalURL}/is-server-running`,
        timeout: timeout,
    })
    .then(response => {
        retriesEngine = 0
        console.log(`[${(new Date()).toISOString().replace('T', ' - ').replace('Z', '')}][I] ${globalURL} is running`)
        clearTimeout(timerEngine)
        timerEngine = setTimeout(checkEngine, intervalEngineCheck)
    })
    .catch(err => {
        if (err && err.request && err.request._response)
            console.warn(`[${(new Date()).toISOString().replace('T', ' - ').replace('Z', '')}][E]`, '[req-answer]', err.request._response)
        if (err && err.response && err.response.request)
            console.warn(`[${(new Date()).toISOString().replace('T', ' - ').replace('Z', '')}][E]`, '[res-answer]', err.response.request._response)
        if (err.response){
            console.warn(`[${(new Date()).toISOString().replace('T', ' - ').replace('Z', '')}][E]`, '[res-data]', err.response.data)
            console.warn(`[${(new Date()).toISOString().replace('T', ' - ').replace('Z', '')}][E]`, '[res-status]', err.response.status)
        }
        if (err && err.response && errorCodes.includes(err.response.status) )
            retriesEngine++
        clearTimeout(timerEngine)
        timerEngine = setTimeout(checkEngine, intervalEngineCheck)
    });
}
const checkService = (port) => {
    clearTimeout(timerService)
    if (stopServiceCheck) return
    axios({
        method: 'get',
        url: `${localURL}/is-server-running`,
        timeout: timeout,
    })
    .then(response => {
        retriesService = 0
        console.log(`[${(new Date()).toISOString().replace('T', ' - ').replace('Z', '')}][I] ${localURL} is running`)
        clearTimeout(timerService)
        timerService = setTimeout(checkService, intervalServiceCheck)
    })
    .catch(err => {
        if (err && err.request && err.request._response)
            console.warn(`[${(new Date()).toISOString().replace('T', ' - ').replace('Z', '')}][E]`, '[req-answer]', err.request._response)
        if (err && err.response && err.response.request)
            console.warn(`[${(new Date()).toISOString().replace('T', ' - ').replace('Z', '')}][E]`, '[res-answer]', err.response.request._response)
        if (err.response){
            console.warn(`[${(new Date()).toISOString().replace('T', ' - ').replace('Z', '')}][E]`, '[res-data]', err.response.data)
            console.warn(`[${(new Date()).toISOString().replace('T', ' - ').replace('Z', '')}][E]`, '[res-status]', err.response.status)
        }
        if (err && err.response && errorCodes.includes(err.response.status) )
            retriesService++
        clearTimeout(timerService)
        timerService = setTimeout(checkService, intervalServiceCheck)
    });
}

const monitorHealth = () => {
    if( stopMonitor ) return console.warn("[!] Health Monitor had been stopped.")
    console.log(`[${(new Date()).toISOString().replace('T', ' - ').replace('Z', '')}][I] Running Health Monitor`)
    if( restartRetries >= restartNumRestart  ){
        console.error("[X] Can not restart server service")
        return fs.appendFile(
            path.join( __dirname, serverFailLogPath ),
            `[${(new Date()).toISOString().replace('T', ' - ').replace('Z', '')}][E] ` +
            `Can not restart ${serverServiceName} service. Tried ${restartRetries} times. Shutting down the Health Monitor...\n`
        )
    }
    else if ( retriesEngine < engineNumReset && retriesService < serviceNumReset ){ 
        clearTimeout(timerMonitor)
        return timerMonitor = setTimeout(monitorHealth, intervalMonitor)
    }
    fs.appendFileSync(
        path.join( __dirname, serverFailLogPath ),
        `[${(new Date()).toISOString().replace('T', ' - ').replace('Z', '')}][I] ` +
        `Engine had ${retriesEngine} retries and ` +
        `Service had ${retriesService} retries. ` +
        `Service is going to restart.\n`
    )
    exec(`service ${serverServiceName} restart`, (err, stdout, stderr)=>{
        if (err){
            console.log(err)
            fs.appendFile(
                path.join( __dirname, serverFailLogPath ),
                `[${(new Date()).toISOString().replace('T', ' - ').replace('Z', '')}][E] ` +
                `There was an error in restarting server: \n` +
                `${err}\n` +
                `Will retry...\n`,
                () => {
                    clearTimeout(timerMonitor)
                    timerMonitor = setTimeout(monitorHealth, intervalMonitor)
                }
            )
            return restartRetries++
        }
        restartRetries = 0
        fs.appendFile(
            path.join( __dirname, serverFailLogPath ),
            `[${(new Date()).toISOString().replace('T', ' - ').replace('Z', '')}][S] ` +
            `Server restarted successfully: \n` +
            stdout&&stdout.length?`out:\n${stdout}\n`:'' +
            stderr&&stderr.length?`err:\n${stderr}\n`:'',
            () => {
                clearTimeout(timerMonitor)
                timerMonitor = setTimeout(monitorHealth, intervalMonitor)
            }
        )
    })
}

clearTimeout(timerMonitor)
timerMonitor = setTimeout(monitorHealth, intervalMonitor)

app.use(express.static('public'))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname + '/public/index.html'))
})

app.post('/login', (req, res) => {
    console.log(req.body)
    const {username, password} = req.body
    const r = checkAuthing({username, password})
    console.log(r)
    if (r){
        const token = crypto.createHash('sha256').update(`${username}-${Date.now()}`).digest('hex')
        tokens[username] = token
        res.status(200).send({lvl: r.lvl, token: `${username}-${token}`})
    }
    else{
        console.log(username, password, logins)
        res.status(404).send()
    }
})

app.post('/restart', (req, res) => {
    const tkn = req.body.token
    const [ username , token ] = tkn.split('-')
    if (tokens[username] === token)
        exec(`service ${serverServiceName} restart`, (err, stdout, stderr)=>{
            if (err){
                console.log(err)
                return res.status(500).send({err:err})
            }
            res.status(200).json({out:stdout, err:stderr})
        })
    else
        res.status(403).send()
})

app.post('/run', (req, res) => {
    const tkn = req.body.token
    const cmd = req.body.cmd
    const [ username , token ] = tkn.split('-')
    if ( cmd === '' )
        return res.status(400).send("empty command")
    if (tokens[username] === token && admins[username] === 1)
        exec(`${cmd}`, (err, stdout, stderr)=>{
            if (err){
                console.log(err)
                return res.status(500).send({err:err})
            }
            res.status(200).json({out:stdout, err:stderr})
        })
    else
        res.status(403).send()
})

app.post('/enable-monitor', ( req, res ) => {
    const tkn = req.body.token
    const [ username , token ] = tkn.split('-')
    if (tokens[username] === token && admins[username] === 1){
        stopMonitor = false
        restartRetries = 0
        clearTimeout(timerMonitor)
        timerMonitor = setTimeout(monitorHealth, intervalMonitor)

        res.status(200).json({ message: result })
    }
    else
        res.status(403).send()
})

app.post('/disable-monitor', ( req, res ) => {
    const tkn = req.body.token
    const [ username , token ] = tkn.split('-')
    if (tokens[username] === token && admins[username] === 1){
        stopMonitor = true

        res.status(200).json({ message: result })
    }
    else
        res.status(403).send()
})

app.post('/set-monitor-params', ( req, res ) => {
    const tkn = req.body.token
    const [ username , token ] = tkn.split('-')
    if (tokens[username] === token && admins[username] === 1){
        let { engine, service, engineInterval, serviceInterval } = req.body

        engine = engine?true:(engine===false?false:undefined)
        service = service?true:(service===false?false:undefined)

        engineInterval = parseInt( engineInterval )
        serviceInterval = parseInt( serviceInterval )

        if( engineInterval ) intervalEngineCheck = engineInterval
        if( serviceInterval ) intervalServiceCheck = serviceInterval

        let result = "Done"

        if( !engine && !service ) return res.status(200).json({ message: result })

        if ( engine !== undefined ) {
            stopEngineCheck = !engine
            result += stopEngineCheck?' deactivating engine check':' activating engine check'
        }
        if ( service !== undefined ) {
            stopServiceCheck = !service
            result += stopServiceCheck?' deactivating service check':' activating service check'
        }

        clearTimeout(timerEngine)
        clearTimeout(timerService)

        retriesEngine = 0
        retriesService = 0

        timerEngine = setTimeout( checkEngine, intervalEngineCheck )
        timerService = setTimeout( checkService, intervalServiceCheck/2 )

        res.status(200).json({ message: result })
    }
    else
        res.status(403).send()
})

app.listen(port, () => console.log(`Server listening on port ${port}!`))