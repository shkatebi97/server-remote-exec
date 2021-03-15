const express = require('express')
const path = require('path')
const fs = require('fs');
const crypto = require('crypto')
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

app.use(express.static('public'))
app.use(express.json())
app.use(express.urlencoded())

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

app.listen(port, () => console.log(`Server listening on port ${port}!`))