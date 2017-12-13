/*
    All share manager APIs
*/

var express = require('express'),
    inspect = require('util').inspect,
    Busboy = require('busboy'),
    path = require('path'),
    os = require('os'),
    fs = require('fs'),
    apisRtnMsg = require('./apisRtnMsg'),
    common = require('../common'),
    sqlUtil = require('../db/mysqlUtil'),
    crypto = require('crypto'),
    Base64 = require('js-base64').Base64,
    uuidV4 = require('uuid/v4'),
    jwt = require('jsonwebtoken'),
    bcrypt = require('bcryptjs'),
    pjson = require('./../package.json'),
    openssl = require('openssl-verify'),
    orm = require('../db/orm'),
    pem = require('pem'),
    ipChk = require('../utils/ipChk.js')

var router = express.Router()

var rtnMsgOk = apisRtnMsg.getMsgType().ok,
    rtnMsgErr = apisRtnMsg.getMsgType().err,
    rtnScenarioUploadCert = apisRtnMsg.getScenario().uploadCert,
    rtnScenarioSignUp = apisRtnMsg.getScenario().signup,
    rtnScenarioDelComm = apisRtnMsg.getScenario().delComm,
    rtnScenarioDownloadComm = apisRtnMsg.getScenario().downloadComm,
    rtnScenarioQuery = apisRtnMsg.getScenario().query,
    rtnScenarioUploadGrantFile = apisRtnMsg.getScenario().uploadGrantFile,
    rtnScenarioChangePasswd = apisRtnMsg.getScenario().changepasswd,
    rtnScenarioAuthentication = apisRtnMsg.getScenario().authentication,
    rtnScenarioSystem = apisRtnMsg.getScenario().system,
    rtnScenarioUploadCom = apisRtnMsg.getScenario().uploadComm,
    NIL = 'nil'

var fileMaxSizeInBytesSignUp = 200000,
    fileMaxSizeInBytesDownloadFile = 200000,
    fileMaxSizeInBytesUploadFile = 200000
// =====================================================

// == signup ===========================================
router.route('/signup')
    .post((req, res) => {
        var ipRaw = req.headers['x-forwarded-for'] || req.connection.remoteAddress
        var ip = ipChk(ipRaw) + ':' + req.socket.remotePort.toString()
        console.log(`== API, signup start ${ip} ===========`)

        var busboy = new Busboy({
            headers: req.headers,
            limits: {
                files: 1,
                fileSize: fileMaxSizeInBytesSignUp
            }
        })

        var hdr = req.headers,
            comO = common.getCommonObj(),
            routerReq = req,
            certId,
            savePathTmp, savePath, fileSize = 0

        busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {

            console.log(`== API, signup busboy file ${ip} ===========`)

            console.log('File [' + fieldname + ']: filename: ' + filename + ', encoding: ' + encoding + ', mimetype: ' + mimetype);

            certId = path.basename(filename, comO.certSuffix)
            savePath = path.join(comO.saveCertDir, filename)
            savePathTmp = path.join(comO.saveCertDir, filename + comO.fileTmpExt)

            console.log(`Sign up file saved @ ${savePath} and temp file @ ${savePathTmp}`)

            // File extension check
            if (path.extname(filename) !== comO.certSuffix) {
                res.json({ message: apisRtnMsg.getRtnMsg(rtnMsgErr, rtnScenarioSignUp, 1), token: NIL })
                errOccur(file)
                return
            }

            // File hash check
            if ((comO.isHashChkEnabled == true) && (hdr.sha1_hash == undefined)) {
                res.json({ message: apisRtnMsg.getRtnMsg(rtnMsgErr, rtnScenarioSignUp, 2), token: NIL })
                errOccur(file)
                return
            }

            // Password exist check
            if (hdr.password == undefined) {
                res.json({ message: apisRtnMsg.getRtnMsg(rtnMsgErr, rtnScenarioSignUp, 0), token: NIL })
                errOccur(file)
                return
            }

            // Cert exist check
            try {
                console.log(`cert exist check ${savePath}`)
                fs.readFileSync(savePath)
                res.json({ message: apisRtnMsg.getRtnMsg(rtnMsgErr, rtnScenarioSignUp, 3), token: NIL })
                errOccur(file)
                return
            } catch (err) {
                if (err.code === 'ENOENT') {
                    console.log(`Cert does not exist, continue`)
                } else {
                    console.log(err.code)
                    errOccur(file)
                    return
                }
            }

            // ===========================================================================
            var ws = fs.createWriteStream(savePathTmp)
            file.pipe(ws)
            file.on('data', (data) => {
                fileSize += data.length
                console.log('File [' + fieldname + '] got ' + data.length + ' bytes');
            })

            var fileSizeLimitation = false
            file.on('limit', () => {
                fileSizeLimitation = true
                console.log(`File size reach limitation`)
                file.unpipe(ws)
                ws.end()
                delAllCert()
                errOccur(file)
            })

            file.on('end', () => {
                console.log('File [' + fieldname + '] Finished');
                file.unpipe(ws)
                ws.end()
            })

            ws.on('finish', () => {

                if (fileSizeLimitation == true) {
                    res.json({ message: apisRtnMsg.getRtnMsg(rtnMsgErr, rtnScenarioUploadCom, 4), token: NIL })
                    return
                }
                var hashSync = sha1HashSync(savePathTmp)
                console.log(`ws finish hashSync ${hashSync}`)

                try {
                    var certificate = fs.readFileSync(savePathTmp, 'utf8');
                    pem.readCertificateInfo(certificate, (err, result) => {
                        if (err) {
                            console.log(err)
                            delAllCert()
                            res.json({ message: apisRtnMsg.getRtnMsg(rtnMsgErr, rtnScenarioSignUp, 4), token: NIL })
                            return
                        } else {
                            // console.log(result)
                            openssl.verifyCertificate(certificate, comO.rootCertFolder, comO.rootCertFolder + '/' + global.rootCACertName, (err, result) => {
                                console.log('openssl verify cert')
                                if (err) {
                                    console.log(err)
                                    delAllCert()
                                } else {
                                    console.log(result);
                                    if ((result.validCert == true) && (result.verifiedCA == true) && (result.expired == false)) {

                                        console.log(`Cert vertified and isHashChkEnabled ${comO.isHashChkEnabled}`)

                                        if ((comO.isHashChkEnabled == true) && (hashSync !== hdr.sha1_hash)) {
                                            delAllCert()
                                            res.json({ message: apisRtnMsg.getRtnMsg(rtnMsgErr, rtnScenarioUploadGrantFile, 3), token: NIL })
                                            return

                                        } else {
                                            if (comO.isHashChkEnabled == true) {
                                                console.log(`upload file hash match ${hashSync}`)
                                            }

                                            console.log(`Temp path ${savePathTmp} => New path ${savePath}`)

                                            fs.rename(savePathTmp, savePath, (err) => {
                                                // updateDbUsersInfoTbl(certId, hdr, comO, res)
                                                var field = {}
                                                field.firstName = (hdr.first_name != undefined) ? '\'' + hdr.first_name + '\'' : 'null'
                                                field.lastName = (hdr.last_name != undefined) ? '\'' + hdr.last_name + '\'' : 'null'
                                                field.contactEmail = (hdr.contact_email != undefined) ? '\'' + hdr.contact_email + '\'' : 'null'
                                                field.contactTel = (hdr.contact_tel != undefined) ? '\'' + hdr.contact_tel + '\'' : 'null'
                                                field.certFileSha1Hash = hashSync
                                                userDbUpdate(filename, field, hdr.password, res)
                                            })
                                        }
                                    } else {
                                        if (result.expired == true)
                                            res.json({ message: apisRtnMsg.getRtnMsg(rtnMsgErr, rtnScenarioSignUp, 5), token: NIL })
                                        else
                                            res.json({ message: apisRtnMsg.getRtnMsg(rtnMsgErr, rtnScenarioSignUp, 4), token: NIL })

                                        delAllCert()
                                    }
                                }
                            }) // openssl.verifyCertificate
                        }
                    })
                } catch (err) {
                    console.log(err)
                }
            })
        })

        busboy.on('field', (fieldname, val, fieldnameTruncated, valTruncated, encoding, mimetype) => {
            console.log('Field [' + fieldname + ']: value: ' + inspect(val));
        })

        busboy.on('finish', () => {
            console.log(`== API, signup busboy finish ${ip} ===========`)
        })

        req.pipe(busboy)

        // ==========================================
        var errOccur = (file) => {
            file.resume()
            console.log(`== API, signup errOccur ${ip} ===========`)
        }

        // var stopPipe = () => {
        // console.log('Stop pipe')
        // routerReq.unpipe(busboy)
        // busboy.end()
        // console.log(`== API, signup end ${ip} ====`)
        // }

        var delAllCert = () => {
            console.log(`delAllCert`)
            try {
                fs.unlinkSync(savePathTmp)
            } catch (err) {
                if (err.code === 'ENOENT') {
                    // res.json({message: apisRtnMsg.getRtnMsg(rtnMsgErr, rtnScenarioDelComm, 0), token: NIL})
                    console.log(`delAllCert no this file ${savePathTmp}`)
                    return false
                } else {
                    console.log(err)
                }
            }

            try {
                fs.unlinkSync(savePath)
            } catch (err) {
                if (err.code === 'ENOENT') {
                    console.log(`delAllCert no this file ${savePath}`)
                    // res.json({message: apisRtnMsg.getRtnMsg(rtnMsgErr, rtnScenarioDelComm, 0), token: NIL})
                    return false
                } else {
                    console.log(err)
                }
            }
            return true
        }
    })

// == login ============================================
router.route('/login')
    .get((req, res) => {

        if (req.headers.authorization != undefined) {

            console.log(`authorization: ` + req.headers.authorization)

            var authStr = req.headers.authorization
            if (authStr.startsWith('Basic ')) {
                var authStrSplit = authStr.split(' '),
                    nameNpass = Base64.decode(authStrSplit[1]),
                    info = nameNpass.split(':'),
                    userName = info[0],
                    password = info[1]

                console.log(`UserName: ${userName}`)
                console.log(`Password: ${password}`)

                orm.userFindByCertId(userName, (results) => {
                    if (Object.keys(results).length === 0) {
                        res.status(401).json({ message: apisRtnMsg.getRtnMsg(rtnMsgErr, rtnScenarioAuthentication, 4), token: NIL })
                    } else {
                        bcrypt.compare(password, results[0].pass_hash, (err, resBcrypt) => {
                            if ((err) || (resBcrypt == false)) {
                                res.status(401).json({ message: apisRtnMsg.getRtnMsg(rtnMsgErr, rtnScenarioAuthentication, 0), token: NIL })
                            } else {
                                res.json({ message: apisRtnMsg.getRtnMsg(rtnMsgOk, rtnScenarioAuthentication, 0), token: genToken(userName) })
                            }
                        })
                    }
                })
            }
        } else {
            res.status(401).json({ message: apisRtnMsg.getRtnMsg(rtnMsgErr, rtnScenarioAuthentication, 1), token: NIL })
        }
    })

var genToken = (subject) => {
    // global.tokenSecretKey = uuidV4()
    // console.log(`Token secretKey ${global.tokenSecretKey}`)
    var comO = common.getCommonObj()
    var expireMin = 60
    var expireHour = 1
    var claims = {
        sub: subject,
        exp: Math.floor(Date.now() / 1000) + (60 * expireMin * expireHour),
        iss: 'https://www.share.com',
        premission: 'normal'
    }
    var token = jwt.sign(claims, global.tokenSecretKey)
    // console.log(`Token ${token}`)
    // fs.appendFileSync('script/test/tokenVal.csv', token + '\n')

    /*
        var theNum = subject.match(/\d+$/)[0];
        if (theNum < 10)
            theNum++ 
        else
            theNum = 1
        var granteeId = 'xxTest' + theNum
        var fileName = 'a.jpg'
        fs.appendFileSync(comO.testCsvFile, `${token},${fileName},${subject}.share.com,${granteeId}.share.com\n`)
    */
    return token
}

var client = {}
// == upload file ============================================
router.route('/uploadfile')
    .post((req, res) => {

        var ipRaw = req.headers['x-forwarded-for'] || req.connection.remoteAddress
        var ip = ipChk(ipRaw) + ':' + req.socket.remotePort.toString()
        console.log(`== API, signup start ${ip} ===========`)

        var hdr = req.headers,
            busboy = new Busboy({
                headers: req.headers,
                limits: {
                    files: 1,
                    fileSize: fileMaxSizeInBytesUploadFile
                }
            }),
            comO = common.getCommonObj(),
            savePath, saveFullPath, saveFullPathTmp, fileSize = 0, certId,
            routerReq = req

        busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
            console.log(`File [${fieldname}]: filename: ${filename}, encoding: ${encoding}, mimetype: ${mimetype}`);

            // Check two params, cert id and file hash format
            if (hdr.sha1_hash == undefined) {
                res.end(apisRtnMsg.getRtnMsg(rtnMsgErr, rtnScenarioUploadCom, 0))
                errOccur(file)
                delete client[ip]
                return
            }

            if (hdr.sha1_hash.length != 40) {
                res.end(apisRtnMsg.getRtnMsg(rtnMsgErr, rtnScenarioUploadCom, 1))
                errOccur(file)
                delete client[ip]
                return
            }

            if (hdr.cert_id == undefined) {
                var certIdLong = req.selfCertId + comO.certIdSuffix
            } else
                certIdLong = hdr.cert_id
            console.log(`cert Id long ${certIdLong}`)
            certId = certIdLong.substring(0, certIdLong.indexOf(comO.certIdSuffix))
            savePath = path.join(comO.saveRemoteGrantFileDir, certId)

            client[ip] = { saveFullPathTmp: undefined }

            saveFullPathTmp = path.join(savePath, filename + comO.fileTmpExt)
            saveFullPath = path.join(savePath, filename)

            var clientPropName = Object.getOwnPropertyNames(client)
            for (var i = 0; i < clientPropName.length; i++) {
                if (client[clientPropName[i]].saveFullPathTmp === saveFullPathTmp) {
                    console.log(`System busy ${ip}`)
                    res.end(apisRtnMsg.getRtnMsg(rtnMsgErr, rtnScenarioSystem, 0))
                    errOccur(file)
                    delete client[ip]
                    return
                }
            }

            client[ip].saveFullPathTmp = saveFullPathTmp
            client[ip].saveFullPath = saveFullPath

            try {
                fs.readFileSync(saveFullPath)
                console.log(saveFullPath)
                if ((hdr.overwrite == undefined) || (hdr.overwrite == 'false')) {
                    res.end(apisRtnMsg.getRtnMsg(rtnMsgErr, rtnScenarioUploadGrantFile, 5))
                    errOccur(file)
                    delete client[ip]
                    return
                } else if (hdr.overwrite == 'true') {
                    console.log(`overwrite is true, keep going.`)
                }

            } catch (err) {
                if (err.code == 'ENOENT') {
                    console.log(`No duplicated file, keep going.`)
                }
            }

            console.log(`Cert ID: ${hdr.cert_id}`)
            console.log(`SHA1 hash: ${hdr.sha1_hash}`)

            if (path.extname(filename) === comO.remoteGrantFileSuffix) {

                try {
                    fs.readdirSync(savePath)
                } catch (err) {
                    if (err.code === 'ENOENT') {
                        res.end(apisRtnMsg.getRtnMsg(rtnMsgErr, rtnScenarioUploadGrantFile, 4))
                        errOccur(file)
                        delete client[ip]
                        return
                    }
                }
            } else {
                res.end(apisRtnMsg.getRtnMsg(rtnMsgErr, rtnScenarioUploadCom, 2))
                errOccur(file)
                delete client[ip]
                return
            }

            var ws = fs.createWriteStream(saveFullPathTmp)
            file.pipe(ws)
            file.on('data', (data) => {
                fileSize += data.length
                console.log(`File [${fieldname}] got ${data.length} bytes from ${ip}`);
            })

            var fileSizeLimitationUploadFile = false
            file.on('limit', () => {
                fileSizeLimitationUploadFile = true
                console.log(`Upload file size reach limitation`)
                file.unpipe(ws)
                ws.end()
                errOccur(file)
            })

            file.on('end', () => {
                console.log('File [' + fieldname + '] Finished');
                file.unpipe(ws)
                ws.end()
            })

            ws.on('finish', () => {

                if (fileSizeLimitationUploadFile == true) {
                    res.json({ message: apisRtnMsg.getRtnMsg(rtnMsgErr, rtnScenarioUploadCom, 4), token: NIL })
                    return
                }

                var hashSync = sha1HashSync(saveFullPathTmp)
                console.log(`ws finish hashSync ${hashSync}`)

                if ((comO.isHashChkEnabled == true) && (hashSync !== hdr.sha1_hash)) {
                    res.json({ message: apisRtnMsg.getRtnMsg(rtnMsgErr, rtnScenarioUploadGrantFile, 3), token: NIL })
                    errOccur(file)
                    return
                } else {
                    if (comO.isHashChkEnabled == true) {
                        console.log(`upload file hash match ${hashSync}`)
                    }

                    console.log(`Rename from ${saveFullPathTmp} to ${saveFullPath}`)
                    fs.rename(saveFullPathTmp, saveFullPath, (err) => {
                        if (err) {
                            console.log(err)
                        } else {

                            // rg_file_path: fieldVal.filePath,
                            // size: fieldVal.size,
                            // last_modified: sequelize.fn('NOW'),
                            // grantee_id: fieldVal.granteeId,
                            // remote_data_files_rd_file_name: fieldVal.rdFileName,
                            // remote_data_files_users_info_cert_id: fieldVal.userCertId,
                            // rg_sha1_hash: fieldVal.sha1Hash

                            var rgFileNameSplit = filename.split('.')
                            var granteeId = rgFileNameSplit[rgFileNameSplit.length - 2]

                            if (granteeId == '+me')
                                granteeId = req.selfCertId

                            var rdFileName = ''
                            for (var i = 0; i < rgFileNameSplit.length - 2; i++) {
                                rdFileName += rgFileNameSplit[i] + '.'
                            }
                            rdFileName += comO.remoteDataFileSuffixNoDot

                            // console.log(`rdFileName: ${rdFileName}`)
                            // console.log(`certId: ${certId}`)

                            var field = {
                                filePath: savePath,
                                size: fileSize,
                                granteeId: granteeId,
                                rdFileName: rdFileName,
                                // field.userCertId = certId
                                userCertId: certId,
                                sha1Hash: hashSync
                            }
                            console.log(`Rename ok`)
                            // rgDbFindOrCreateByFileName(filename, field, res, ip)
                            setTimeout(() => {
                                rgDbFindOrCreateByFileName(filename, field, res, ip)
                            }, 1000)
                        }
                    })
                }
            })
        })

        busboy.on('field', function (fieldname, val, fieldnameTruncated, valTruncated, encoding, mimetype) {
            console.log('Field [' + fieldname + ']: value: ' + inspect(val));
        })

        busboy.on('finish', () => {
            console.log(`== API, signup busboy finish ${ip} ===========`)
        })

        req.pipe(busboy)

        var errOccur = (file) => {
            file.resume()
            console.log(`== API, signup errOccur ${ip} ===========`)
        }

        // var stopPipe = () => {
        // console.log('Stop pipe')
        // routerReq.unpipe(busboy)
        // busboy.end()
        // }
    })
/*
router.route('/uploadfile')
.post((req, res) => {

    console.log(req.headers)
    console.log(req.body)
    var hdr = req.headers

    var busboy = new Busboy({ headers: req.headers });
    var comObj = common.getCommonObj()
    var savePath, fileSize, fileNameInput, certId
    var terminated = false

    busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
        console.log('File [' + fieldname + ']: filename: ' + filename + ', encoding: ' + encoding + ', mimetype: ' + mimetype);
        // console.log('os type: ' + os.type())
        // console.log('os temp directory: ' + os.tmpdir())
        // if (mimetype === 'application/x-x509-ca-cert') {
        // } else if (mimetype === 'application/octet-stream') {
        // }
        if (path.extname(filename) === comObj.certSuffix) {
            console.log(`Cert is uploading, so this action should treat as user registration`)
            if (hdr.password == undefined) {
                res.end(apisRtnMsg.getRtnMsg(msgType.err, scenario.uploadComm, 3))
                terminated = true
                return
            }
        }
        // Check two params, cert id and file hash format
        if ( (hdr.cert_id == undefined) || (hdr.sha1_hash == undefined) ) {
            res.end(apisRtnMsg.getRtnMsg(msgType.err, scenario.uploadComm, 0))
            terminated = true
            return
        }

        if (hdr.sha1_hash.length != 40) {
            res.end(apisRtnMsg.getRtnMsg(msgType.err, scenario.uploadComm, 1))
            terminated = true
            return
        }

        console.log(`Cert ID: ${hdr.cert_id}`)
        console.log(`SHA1 hash: ${hdr.sha1_hash}`)

        if (path.extname(filename) === comObj.certSuffix) {
            savePath = comObj.saveCertDir
        } else if (path.extname(filename) === comObj.remoteGrantFileSuffix) {
            var certIdLong = hdr.cert_id
            certId = certIdLong.substring(0, certIdLong.indexOf(comObj.certIdSuffix))
            savePath = comObj.saveRemoteGrantFileDir + '/' + certId

            try {
                fs.readdirSync(savePath)
            } catch (err) {
                if (err.code === 'ENOENT') {
                    res.end(apisRtnMsg.getRtnMsg(msgType.err, scenario.uploadGrantFile, 4))
                    terminated = true
                    return
                }
            }
        } else {
            res.end(apisRtnMsg.getRtnMsg(msgType.err, scenario.uploadComm, 2))
            terminated = true
            return
        }

        var saveTo = path.join(savePath, filename)
        fileNameInput = filename

        console.log('Save to: ' + saveTo)
        fs.open(saveTo, 'wx', (err, fd) => {
            if (err) {
                var overwrite
                if (hdr.overwrite == undefined)
                    overwrite = 'false'
                else
                    overwrite = hdr.overwrite

                if ((err.code === 'EEXIST') && (overwrite === 'false')) {
                    // res.writeHead(200, { 'Connection': 'close' });
                    res.end(apisRtnMsg.getRtnMsg(msgType.err, scenario.uploadCert, 0));
                    terminated = true
                    return
                }
            }

            file.pipe(fs.createWriteStream(saveTo))
            file.on('data', (data) => {
                fileSize = data.length
                console.log('File [' + fieldname + '] got ' + data.length + ' bytes');
            })

            file.on('end', () => {
                console.log('File [' + fieldname + '] Finished');
            })
        })
    })

    busboy.on('field', function(fieldname, val, fieldnameTruncated, valTruncated, encoding, mimetype) {
        console.log('Field [' + fieldname + ']: value: ' + inspect(val));
    })

    busboy.on('finish', () => {

        if (terminated == true) return

        var fileFullPath = savePath + '/' + fileNameInput
        console.log(`busboy.on finish ${fileFullPath}`);

        var hashC = crypto.createHash('sha1'),
            stream = fs.createReadStream(fileFullPath);

        stream.on('data', function (data) {
            hashC.update(data, 'utf8')
        })

        stream.on('end', function () {

            var hash = hashC.digest('hex');
            // var hash = `123d`
            console.log(`upload file hash ${hash}`)

            // Compare with hash in header
            var comObj = common.getCommonObj()
            console.log(`isHashChkEnabled ${comObj.isHashChkEnabled}`)
            if( (comObj.isHashChkEnabled == true) && (hash !== hdr.sha1_hash) ){
                fs.unlink(fileFullPath, (err) => {
                    if (err) {
                        console.log(`delete error: ${err.code}`)
                        if (err.code === 'ENOENT') {
                            res.end(apisRtnMsg.getRtnMsg(msgType.err, scenario.delComm, 0))
                        }
                    } else {
                        res.end(apisRtnMsg.getRtnMsg(msgType.err, scenario.uploadGrantFile, 3));
                    }
                })
                return
            } else {
                if (comObj.isHashChkEnabled == true)
                    console.log(`Hash match`)
            }

            if (savePath.startsWith(comObj.saveCertDir)) {
                updateDbUsersInfoTbl(fileNameInput, hdr, comObj, res)
            } else if (savePath.startsWith(comObj.saveRemoteGrantFileDir)) {

                var rgFileNameSplit = fileNameInput.split('.')
                var granteeId = '\'' + rgFileNameSplit[rgFileNameSplit.length-2] + '\''

                var rdFileName = ''
                for(var i=0; i<rgFileNameSplit.length-2; i++) {
                    rdFileName += rgFileNameSplit[i] + '.'
                }
                rdFileName = '\'' + rdFileName + comObj.remoteDataFileSuffixNoDot + '\''

                var col = [comObj.dbTblRemoteDataFiles.rdFileName, comObj.dbTblRemoteDataFiles.foreign_usersInfoCertId]
                var colVal = [rdFileName, '\'' + certId + '\'']
                var selRecFromRemoteDataFilesTbl = sqlUtil.parserSelRecCmd(comObj.dbTblRemoteDataFiles.tblName, col, colVal)
                console.log(selRecFromRemoteDataFilesTbl)
                global.sqlConn.query(selRecFromRemoteDataFilesTbl, (error, results, fields) => {
                    if (error) {
                    } else {
                        if (results.length > 0) {
                            console.log(results[0].users_info_cert_id)
                            updateDbGrantFilesTbl(fileNameInput, fileSize, comObj, res, results[0].users_info_cert_id, granteeId, rdFileName, certId, hdr)
                        } else {
                            // console.log('sqlCmd ok')
                            // res.writeHead(200, { 'Connection': 'close' });
                            res.end(apisRtnMsg.getRtnMsg(msgType.err, scenario.uploadGrantFile, 0));
                        }
                    }
                })
            }
        }) // stream.on('end', function () {
    });

    req.pipe(busboy);
})
*/
// ===========================================================================

String.prototype.capitalizeFirstLetter = function () {
    return this.charAt(0).toUpperCase() + this.slice(1);
}

var userDbUpdate = (userCertFileName, field, pass, res) => {
    var certIdForFolder = userCertFileName.substring(0, userCertFileName.lastIndexOf('.'))
    var saltRounds = 10
    bcrypt.hash(pass, saltRounds, (err, passHash) => {
        console.log(`bcrypt hash for password saving: ${passHash}`)
        field.passHash = passHash
        orm.userFindOrCreateByCertId(certIdForFolder, field, (result) => {
            if (result) {

                console.log(`User record is inserted.`)

                var comO = common.getCommonObj()
                var userFolder = [comO.saveRemoteDataFileDir + '/' + certIdForFolder, comO.saveRemoteGrantFileDir + '/' + certIdForFolder]

                fs.readdir(userFolder[0], (err, files) => {
                    if (err) {
                        if (err.code === 'ENOENT') {
                            fs.mkdirSync(userFolder[0])
                        }
                    }
                })

                fs.readdir(userFolder[1], (err, files) => {
                    if (err) {
                        if (err.code === 'ENOENT') {
                            fs.mkdirSync(userFolder[1])
                        }
                    }
                })

                console.log(`certIdForFolder ${certIdForFolder}`)
                var token = genToken(certIdForFolder)
                res.json({ message: apisRtnMsg.getRtnMsg(rtnMsgOk, rtnScenarioUploadCert, 0), token: token })

            } else {
                console.log(`User record is NOT inserted. Cert upload ok, but had some old user info, so update it`)
                orm.userUpdateByCertId(certIdForFolder, field, (result) => {
                    if (result) {
                        res.json({ message: apisRtnMsg.getRtnMsg(rtnMsgOk, rtnScenarioUploadCert, 0), token: token })
                    }
                })
            }
        })
    })
}

var delGrantTmpFile = (savaPath) => {
    var comO = common.getCommonObj()
    fs.readdir(savaPath, (err, files) => {
        for (var i = 0, len = files.length; i < len; i++) {
            var match = files[i].match(/.*.tmp/)
            if (match !== null)
                fs.unlinkSync('remoteGrantFiles/a/' + match[0])
        }
    })
}

var rgDbFindOrCreateByFileName = (filename, field, res, ip) => {
    console.log(field)
    orm.rgFilesFindOrCreateByFileName(filename, field, (result) => {
        if ((typeof result === 'string' || result instanceof String)) {
            res.end(result)
            delete client[ip]
            delGrantTmpFile(field.filePath)
        } else if (result) {
            res.end(apisRtnMsg.getRtnMsg(rtnMsgOk, rtnScenarioUploadGrantFile, 0))
            delete client[ip]
            delGrantTmpFile(field.filePath)
        } else {
            // res.end(apisRtnMsg.getRtnMsg(rtnMsgErr, rtnScenarioUploadGrantFile, 5))
            console.log(`Remote grant file is NOT inserted.`)
            rgDbUpdateByFileName(filename, field, res, ip)
        }
    })
}

var rgDbUpdateByFileName = (filename, field, res, ip) => {
    console.log(`rgDbUpdateByFileName, filename: ${filename}, field: ${field}`)
    orm.rgFilesUpdateByFileName(filename, field, result => {
        console.log(`rgDbUpdateByFileName ${result}`)
        if (typeof result === 'string' || result instanceof String) {
            res.end(result)
        } else if (result == 1) {
            res.end(apisRtnMsg.getRtnMsg(rtnMsgOk, rtnScenarioUploadGrantFile, 0))
        } else {
            res.end(apisRtnMsg.getRtnMsg(rtnMsgErr, rtnScenarioUploadGrantFile, 6))
        }
        delete client[ip]
        delGrantTmpFile(field.filePath)
    })
}

function updateDbUsersInfoTbl(fileNameInput, hdr, comObj, res) {

    console.log(`updateDbUsersInfoTbl fileNameInput: ${fileNameInput}`)

    var certIdForFolder = ''
    if (hdr.cert_id != undefined) {
        var certIdSuffixIdx = hdr.cert_id.indexOf(comObj.certIdSuffix)
        console.log('certIdSuffixIdx: ' + certIdSuffixIdx)
        if (certIdSuffixIdx > 0) {
            var id = '\'' + hdr.cert_id.substring(0, certIdSuffixIdx) + '\''
            certIdForFolder = hdr.cert_id.substring(0, certIdSuffixIdx)
        } else {
            id = '\'' + hdr.cert_id + '\''
            certIdForFolder = hdr.cert_id
        }
    } else {
        if (fileNameInput.lastIndexOf('.') < 0) {
            certIdForFolder = fileNameInput
            id = '\'' + certIdForFolder + '\''
        } else {
            certIdForFolder = fileNameInput.substring(0, fileNameInput.lastIndexOf('.'))
            id = '\'' + certIdForFolder + '\''
        }
    }

    var firstName = (hdr.first_name != undefined) ? '\'' + hdr.first_name + '\'' : 'null'
    var lastName = (hdr.last_name != undefined) ? '\'' + hdr.last_name + '\'' : 'null'
    var email = (hdr.contact_email != undefined) ? '\'' + hdr.contact_email + '\'' : 'null'
    var tel = (hdr.contact_tel != undefined) ? '\'' + hdr.contact_tel + '\'' : 'null'

    var generator = require('generate-password');
    var pass = '\'' + generator.generate({
        length: 8,
        numbers: true
    }) + '\''

    var saltRounds = 10
    console.log(`Header pass ${hdr.password}, self-gen pass ${pass}`)

    bcrypt.hash(hdr.password, saltRounds, (err, hash) => {
        console.log(`bcrypt hash for password saving: ${hash}`)

        // if (bcrypt.compareSync('123456', hash) == true)
        // console.log(`PASS OK`)

        var insertRecIntoUsersInfoTbl = sqlUtil.parserInsertRecCmd(comObj.dbTblUsersInfo.tblName, {
            cert_id: id,
            first_name: firstName,
            last_name: lastName,
            contact_email: email,
            contact_tel: tel,
            pass_hash: '\'' + hash + '\'',
            cert_file_sha1_hash: '\'' + hdr.sha1_hash + '\''
        })

        if (hdr.overwrite == 'true') {
            // var selRecIntoUsersInfoTbl = sqlUtil.parserSelRecCmd(

            // console.log(selRecIntoUsersInfoTbl)
            // global.sqlConn.query(insertRecIntoUsersInfoTbl, (error, results, fields) => {
            // }
        }

        console.log(insertRecIntoUsersInfoTbl)
        global.sqlConn.query(insertRecIntoUsersInfoTbl, (error, results, fields) => {
            if (error) {
                // console.log(error)
                console.log(error.code)
                if (error.code == 'ER_DUP_ENTRY') {
                    var rtn = apisRtnMsg.getRtnMsg(msgType.err, scenario.uploadCert, 3)
                } else if (error.code == 'ER_PARSE_ERROR') {
                    var rtn = apisRtnMsg.getRtnMsg(msgType.err, scenario.db, 3)
                } else if (error.code == 'ER_BAD_FIELD_ERROR') {
                    var rtn = apisRtnMsg.getRtnMsg(msgType.err, scenario.db, 4)
                }
            } else {

                // Create folder
                var comO = common.getCommonObj()
                var userFolder = [comO.saveRemoteDataFileDir + '/' + certIdForFolder, comO.saveRemoteGrantFileDir + '/' + certIdForFolder]

                fs.readdir(userFolder[0], (err, files) => {
                    if (err) {
                        if (err.code === 'ENOENT') {
                            fs.mkdirSync(userFolder[0])
                        }
                    }
                })

                fs.readdir(userFolder[1], (err, files) => {
                    if (err) {
                        if (err.code === 'ENOENT') {
                            fs.mkdirSync(userFolder[1])
                        }
                    }
                })
            }

            console.log(`certIdForFolder ${certIdForFolder}`)
            var token = genToken(certIdForFolder)
            res.json({ message: apisRtnMsg.getRtnMsg(msgType.ok, scenario.uploadCert, 0), token: token })
        })
    })
}

function updateDbGrantFilesTbl(rgFileName, size, comObj, res, fromCertId, granteeId, rdFileName, certId, hdr) {
    /*
        var rgFileNameSplit = rgFileName.split('.')
        var granteeId = '\'' + rgFileNameSplit[rgFileNameSplit.length-2] + '\''

        var rdFileName = ''
        for(var i=0; i<rgFileNameSplit.length-2; i++) {
            rdFileName += rgFileNameSplit[i] + '.'
        }
        rdFileName = '\'' + rdFileName + comObj.remoteDataFileSuffixNoDot + '\''
    */
    var hash = '\'' + hdr.sha1_hash + '\''
    var insertRecIntoRemoteGrantFilesTbl = sqlUtil.parserInsertRecCmd(comObj.dbTblRemoteGrantFiles.tblName, {
        rg_file_name: '\'' + rgFileName + '\'',
        rg_file_path: '\'/' + comObj.saveRemoteGrantFileDir + '/' + certId + '\'',
        size: size,
        last_modified: 'now()',
        grantee_id: granteeId,
        remote_data_files_rd_file_name: rdFileName,
        remote_data_files_users_info_cert_id: '\'' + fromCertId + '\'',
        rg_file_sha1_hash: hash,
        updata_date: 'now()',
    })

    console.log(insertRecIntoRemoteGrantFilesTbl)

    global.sqlConn.query(insertRecIntoRemoteGrantFilesTbl, (error, results, fields) => {
        if (error) {
            /*
            var errStr = error.code.toString()
            if (errStr == 'ER_DUP_ENTRY') {
                var rtn = apisRtnMsg.getRtnMsg(msgType.err, scenario.db, 0)
            } else if (errStr === 'ER_BAD_FIELD_ERROR') {
                rtn = apisRtnMsg.getRtnMsg(msgType.err, scenario.db, 1)
            } else if (errStr.startsWith('ER_NO_REFERENCED')) {
                rtn = apisRtnMsg.getRtnMsg(msgType.err, scenario.db, 2)
            }
            */
            var rtn = checkDbErr(error.code)
        } else {
            // console.log('sqlCmd ok')
            rtn = apisRtnMsg.getRtnMsg(msgType.ok, scenario.uploadGrantFile, 0)
        }
        // res.writeHead(200, { 'Connection': 'close' });
        res.end(rtn);
    })
}

// == site info ===============================================
router.route('/siteinfo')
    .get((req, res) => {

        var comO = common.getCommonObj()

        console.log(`site version ${pjson.version}`)
        // console.log(req.headers)

        var info = {
            'version': pjson.version,
            'isFileUpDownHashChkEnable': comO.isHashChkEnabled,
            'isAuthEnable': comO.isNeedAuth,
            'isTcpWithSSL': comO.isTcpWithSSL
        }

        res.json(info)
    })

// == query file exist ===============================================
router.route('/queryFileExist/:fileName')
    .get((req, res) => {
        console.log(`User Name ${req.selfCertId}`)
        var fileName = req.params.fileName,
            comO = common.getCommonObj()

        var queryFileFullPath = path.join(comO.saveRemoteDataFileDir, req.selfCertId, fileName)
        console.log(`queryFileFullPath ${queryFileFullPath}`)
        try {
            fs.readFileSync(queryFileFullPath)
            res.end(apisRtnMsg.getRtnMsg(rtnMsgOk, rtnScenarioQuery, 0))
        } catch (err) {
            if (err.code == 'ENOENT') {
                res.end(apisRtnMsg.getRtnMsg(rtnMsgErr, rtnScenarioQuery, 1))
            } else {
                console.log(err)
            }
        }
    })

// == query ===============================================
router.route('/query/:queryType/:selfUserCertId/')
    .get((req, res) => {
        var queryType = req.params.queryType,
            selfUserCertId = req.params.selfUserCertId,
            comO = common.getCommonObj()

        if (selfUserCertId.includes(comO.certIdSuffix)) {
            var selfUserCertIdSplit = selfUserCertId.split(comO.certIdSuffix)
            selfUserCertId = selfUserCertIdSplit[0]
        }

        if (queryType === 'InvitationList') {
            console.log('queryInvLst')
            queryInvLst(res, selfUserCertId, comO)
        } else if (queryType === 'SelfOwnedFileList') {
            console.log('querySelfOwnLst')
            querySelfOwnLst(res, selfUserCertId, comO)
        } else {
            res.end(apisRtnMsg.getRtnMsg(rtnMsgErr, rtnScenarioQuery, 0))
        }
    })

var queryInvLst = (res, selfCertId, comO) => {
    orm.rgFilesFindByGranteeId(selfCertId, (results) => {
        var invitationList = []
        if (results.length > 0) {
            results.forEach((element) => {
                var item = {}
                item['grantFile'] = element.rg_file_name
                item['datafile'] = element.remote_data_files_rd_file_name
                item['from'] = element.remote_data_files_users_info_cert_id + comO.certIdSuffix
                invitationList.push(item)
            })
        }
        res.json({
            invitationList
        })
    })
}
/*
function queryInvLst(res, selfCertId) {

    var comObj = common.getCommonObj()
    var queryCmd = sqlUtil.parserSelRecCmd(comObj.dbTblRemoteGrantFiles.tblName, comObj.dbTblRemoteGrantFiles.granteeId, '\'' + selfCertId + '\'')
    console.log(queryCmd)

    global.sqlConn.query(queryCmd, (error, results, fields) => {
        if (error) {
        } else {
            console.log('sqlCmd ok')
            var invitationList = []
            console.log(results.length)
            // console.log(results[0])
            // console.log(results[1])
            if (results.length > 0) {
                results.forEach((element) => {
                    console.log(element.rg_file_name)
                    console.log(element.remote_data_files_rd_file_name)
                    console.log(element.remote_data_files_users_info_cert_id)
                    var item = {}
                    item['grantFile'] = element.rg_file_name;
                    item['datafile'] = element.remote_data_files_rd_file_name;
                    item['from'] = element.remote_data_files_users_info_cert_id + comObj.certIdSuffix;
                    invitationList.push(item);
                })
            }

            res.json({
                invitationList
            });
        }
    })
}
*/
var querySelfOwnLst = (res, selfCertId, comO) => {
    orm.rdFilesFindByUserCertId(selfCertId, results => {
        var selfOwnList = []
        for (var i = 0; i < results.length; i++) {
            // if (selfCertId != results[i].grantee_id)
            {
                var item = {}
                item['datafile'] = results[i].rd_file_name
                console.log(`grant file name ${results[i].rg_file_name}`)
                if ((((results[i].rg_file_name == null) && (results[i].grantee_id) == null)) ||
                    (results[i].rg_file_name.includes('+me'))) {
                    item['granteeId'] = 'Null grantee'
                } else {
                    item['granteeId'] = results[i].grantee_id + comO.certIdSuffix
                }
                selfOwnList.push(item)
            }
        }

        res.json({
            selfOwnList
        })
    })
    /*    
        orm.rgFilesFindByCertId(selfCertId, results => {
        
            var selfOwnList = []
            for (var i = 0; i < results.length; i++) {
                var item = {}
                item['datafile'] = results[i].remote_data_files_rd_file_name
                item['granteeId'] = results[i].grantee_id + comO.certIdSuffix
                selfOwnList.push(item)
            }
    
            res.json({
                selfOwnList
            })
        })
    */
}
/*
function querySelfOwnLst(res, selfCertId) {

    var comObj = common.getCommonObj()
    // var queryCmd = sqlUtil.parserSelRecCmd(comObj.dbTblRemoteDataFiles.tblName, comObj.dbTblRemoteDataFiles.foreign_usersInfoCertId, '\'' + selfCertId + '\'')
    var queryCmd = 'select rg_file_name, remote_data_files_rd_file_name, grantee_id from remote_grant_files where remote_data_files_users_info_cert_id = \'' + selfCertId + '\'\;';
    console.log(queryCmd)

    global.sqlConn.query(queryCmd, (error, results, fields) => {
        if (error) {
        } else {
            console.log('sqlCmd ok')
            var selfOwnList = []
            console.log(results.length)
            // console.log(results[0])
            // console.log(results[1])
            if (results.length > 0) {
                results.forEach((element) => {
                    console.log(element.rg_file_name)
                    console.log(element.remote_data_files_rd_file_name)
                    console.log(element.grantee_id)
                    var item = {}
                    item['datafile'] = element.remote_data_files_rd_file_name;
                    item['granteeId'] = element.grantee_id + comObj.certIdSuffix;
                    selfOwnList.push(item);
                })
            }

            res.json({
                selfOwnList
            });
        }
    })
}
*/

// == download file ============================================
router.route('/downloadfile/:fileName/:fromUserCertId/')
    .get((req, res) => {

        var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress
        console.log(`== API, downloadfile start ${ipChk(ip)}:${req.socket.remotePort} ===========`)

        var fileName = req.params.fileName,
            certIdLong = req.params.fromUserCertId,
            comO = common.getCommonObj(),
            certId = certIdLong.substring(0, certIdLong.indexOf(comO.certIdSuffix))

        if (path.extname(fileName) === comO.certSuffix)
            savePath = comO.saveCertDir
        else if (path.extname(fileName) === comO.remoteDataFileSuffix)
            savePath = comO.saveRemoteDataFileDir + '/' + certId
        else if (path.extname(fileName) === comO.remoteGrantFileSuffix)
            savePath = comO.saveRemoteGrantFileDir + '/' + certId
        else {
            res.end(apisRtnMsg.getRtnMsg(rtnMsgErr, rtnScenarioDownloadComm, 3))
            return
        }
        console.log(`Download from ${savePath} folder`)

        try {
            fs.readdirSync(savePath)
        } catch (err) {
            if (err.code === 'ENOENT') {
                res.end(apisRtnMsg.getRtnMsg(rtnMsgErr, rtnScenarioDownloadComm, 0))
                return
            } else {
                console.log(err)
            }
        }

        var saveFullPath = path.join(savePath, fileName)
        console.log(`Download from ${saveFullPath}`)

        try {
            var file = fs.readFileSync(saveFullPath)
            if (file.length > fileMaxSizeInBytesDownloadFile) {
                res.end(apisRtnMsg.getRtnMsg(rtnMsgErr, rtnScenarioDownloadComm, 4))
                return
            }
        } catch (err) {
            if (err.code === 'ENOENT') {
                res.end(apisRtnMsg.getRtnMsg(rtnMsgErr, rtnScenarioDownloadComm, 0))
                return
            } else {
                console.log(err)
            }
        }

        var hashSync = sha1HashSync(saveFullPath)
        console.log(`HashSync: ${hashSync}`)

        console.log('File len: ' + file.length)
        res.setHeader('Content-Length', file.length)
        res.setHeader('sha1_hash', hashSync)
        res.download(saveFullPath, (err) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    res.end(apisRtnMsg.getRtnMsg(rtnMsgErr, rtnScenarioDownloadComm, 0))
                } else {
                    console.log(`res.download error ${err}`)
                }
            }
            console.log(`== API, downloadfile end ${ipChk(ip)}:${req.socket.remotePort} ===========`)
        })
    })

// == delete data file ================================
router.route('/delfile/:fileName')
    .get((req, res) => {

        console.log(`User Name ${req.selfCertId}`)

        var comO = common.getCommonObj(),
            fileName = req.params.fileName,
            grantorCertId = req.selfCertId,
            datFileName = fileName + comO.remoteDataFileSuffix

        orm.rgFilesDelByUserCertId(fileName + '%', grantorCertId, result => {

            if ((typeof result === 'string' || result instanceof String)) {
                res.end(result)
            } else if (result > 0) {
                var delPath = path.join(comO.saveRemoteGrantFileDir, grantorCertId)
                var files = fs.readdirSync(delPath)
                for (var i = 0; i < files.length; i++) {
                    if (files[i].startsWith(fileName)) {
                        var delFullPath = path.join(delPath, files[i])
                        console.log(`delFullPath ${delFullPath}`)
                        try {
                            fs.unlinkSync(delFullPath)
                        } catch (err) {
                            if (err.code === 'ENOENT') {
                                console.log(`No this file`)
                                res.end(apisRtnMsg.getRtnMsg(rtnMsgErr, rtnScenarioDelComm, 0))
                            } else {
                                console.log(err)
                            }
                        }
                    }
                }
            }

            orm.rdFilesDelByFileNameAndUserCertId(datFileName, grantorCertId, result => {

                console.log(`delete files ${result}`)

                if ((typeof result === 'string' || result instanceof String)) {
                    res.end(result)
                } else if (result > 0) {
                    var delPath = path.join(comO.saveRemoteDataFileDir, grantorCertId),
                        delFullPath = path.join(delPath, datFileName)

                    fs.unlink(delFullPath, err => {
                        if (err) {
                            console.log(`delete error: ${err.code} @ ${delFullPath}`)
                            if (err.code === 'ENOENT') {
                                res.end(apisRtnMsg.getRtnMsg(rtnMsgErr, rtnScenarioDelComm, 0))
                            } else {
                                console.log(`delete ${err}`)
                            }
                        } else {
                            res.end(apisRtnMsg.getRtnMsg(rtnMsgOk, rtnScenarioDelComm, 2))
                        }
                    })
                } else if (result == 0) {
                    res.end(apisRtnMsg.getRtnMsg(rtnMsgErr, rtnScenarioDelComm, 1))
                }
            })
        })
    })

// == delete grantee =======================================
router.route('/delgrantee/:fileName/:granteeCertId')
    .get((req, res) => {
        console.log(`User Name ${req.selfCertId}`)

        var comO = common.getCommonObj(),
            fileName = req.params.fileName,
            granteeCertIdLong = req.params.granteeCertId,
            grantorCertId = req.selfCertId,
            granteeCertId = granteeCertIdLong.substring(0, granteeCertIdLong.indexOf(comO.certIdSuffix))


        // orm.rgFilesDelByUserCertIdAndGrantee(fileName + comO.remoteDataFileSuffix, grantorCertId, granteeCertId, result => {
        orm.rgFilesDelByFilenameAndUserCertIdAndGrantee(fileName + '.' + granteeCertId + comO.remoteGrantFileSuffix, grantorCertId, granteeCertId, result => {
            console.log(`delete files ${result}`)

            if ((typeof result === 'string' || result instanceof String)) {
                res.end(result)
            } else if (result > 0) {

                var delPath = path.join(comO.saveRemoteGrantFileDir, grantorCertId),
                    delFullPath = path.join(delPath, fileName + '.' + granteeCertId + comO.remoteGrantFileSuffix)

                fs.unlink(delFullPath, (err) => {
                    if (err) {
                        console.log(`delete error: ${err.code} @ ${delFullPath}`)
                        if (err.code === 'ENOENT') {
                            res.end(apisRtnMsg.getRtnMsg(rtnMsgErr, rtnScenarioDelComm, 0))
                        } else {
                            console.log(`delete ${err}`)
                        }
                    } else {
                        res.end(apisRtnMsg.getRtnMsg(rtnMsgOk, rtnScenarioDelComm, 1))
                    }
                })
            } else if (result == 0) {
                res.end(apisRtnMsg.getRtnMsg(rtnMsgErr, rtnScenarioDelComm, 1))
            }
        })
    })

// == delete file =======================================
router.route('/delfile/:fileName/:grantorCertId/:granteeCertId')
    .get((req, res) => {
        var comO = common.getCommonObj(),
            fileName = req.params.fileName,
            grantorCertIdLong = req.params.grantorCertId,
            granteeCertIdLong = req.params.granteeCertId,
            grantorCertId = grantorCertIdLong.substring(0, grantorCertIdLong.indexOf(comO.certIdSuffix)),
            granteeCertId = granteeCertIdLong.substring(0, granteeCertIdLong.indexOf(comO.certIdSuffix))

        orm.rgFilesDelByUserCertIdAndGrantee(fileName + comO.remoteDataFileSuffix, grantorCertId, granteeCertId, result => {
            console.log(`delete files ${result}`)

            if ((typeof result === 'string' || result instanceof String)) {
                res.end(result)
            } else if (result > 0) {

                var delPath = path.join(comO.saveRemoteGrantFileDir, grantorCertId),
                    delFullPath = path.join(delPath, fileName + '.' + granteeCertId + comO.remoteGrantFileSuffix)
                console.log(`Del db entry succ, going to del usc file @ ${delFullPath} too`)

                fs.unlink(delFullPath, (err) => {
                    if (err) {
                        console.log(`delete error: ${err.code} @ ${delFullPath}`)
                        if (err.code === 'ENOENT') {
                            res.end(apisRtnMsg.getRtnMsg(rtnMsgErr, rtnScenarioDelComm, 0))
                        } else {
                            console.log(`delete ${err}`)
                        }
                    } else {
                        // Check any related grant file if not, go to delete data file either
                        fs.readdir(delPath, (err, files) => {
                            for (var i = 0, len = files.length; i < len; i++) {
                                // console.log(files[i])
                                if (files[i].startsWith(fileName + '.')) {
                                    res.end(apisRtnMsg.getRtnMsg(rtnMsgOk, rtnScenarioDelComm, 0))
                                    return
                                }
                            }

                            orm.rdFilesDelByFileNameAndUserCertId(fileName + comO.remoteDataFileSuffix, grantorCertId, result => {
                                if ((typeof result === 'string' || result instanceof String)) {
                                    res.end(result)
                                } else if (result > 0) {

                                    delPath = path.join(comO.saveRemoteDataFileDir, grantorCertId)
                                    delFullPath = path.join(delPath, fileName + comO.remoteDataFileSuffix)
                                    console.log(`Del data file @ ${delFullPath}`)

                                    fs.unlink(delFullPath, (err) => {
                                        if (err) {
                                            if (err.code === 'ENOENT') {
                                                res.end(apisRtnMsg.getRtnMsg(rtnMsgErr, rtnScenarioDelComm, 0))
                                            }
                                        } else {
                                            res.end(apisRtnMsg.getRtnMsg(rtnMsgOk, rtnScenarioDelComm, 0))
                                        }
                                    })
                                }
                            })
                        })
                    }
                })
            } else if (result == 0) {
                res.end(apisRtnMsg.getRtnMsg(rtnMsgErr, rtnScenarioDelComm, 1))
            }
        })
    })

var delProc = (tableName, col, colVal, res, comO, fileName, grantorCertId, granteeCertId) => {
    var queryCmd = sqlUtil.parserSelRecCmd(tableName, col, colVal)
    console.log(queryCmd)

    global.sqlConn.query(queryCmd, (error, results, fields) => {
        if (error) {
            console.log(error)
            res.end(checkDbErr(error.code))
        } else {
            if (results.length == 1) {
                console.log(results[0])

                var col = [comO.dbTblRemoteGrantFiles.foreign_remoteDataFilesRdFileName, comO.dbTblRemoteGrantFiles.foreign_remote_data_files_users_info_cert_id, comO.dbTblRemoteGrantFiles.granteeId]
                var colVal = ['\'' + results[0].remote_data_files_rd_file_name + '\'', '\'' + results[0].remote_data_files_users_info_cert_id + '\'', '\'' + results[0].grantee_id + '\'']
                var queryCmd = sqlUtil.parserDelRecCmd(comO.dbTblRemoteGrantFiles.tblName, col, colVal)
                console.log(queryCmd)

                global.sqlConn.query(queryCmd, (error, results, fields) => {
                    if (error) {
                        console.log(error)
                        res.end()
                    } else {
                        console.log(`Del db entry succ, go to del file (.usc) too`)

                        var delPathFolder = comO.saveRemoteGrantFileDir + '/' + grantorCertId
                        var delPath = delPathFolder + '/' + fileName + '.' + granteeCertId + comO.remoteGrantFileSuffix

                        console.log(`Del Path ${delPath}`)
                        fs.unlink(delPath, (err) => {
                            if (err) {
                                console.log(`delete error: ${err.code}`)
                                if (err.code === 'ENOENT') {
                                    res.end(apisRtnMsg.getRtnMsg(msgType.err, scenario.delComm, 0))
                                }
                            } else {
                                // Check any related grant file if not, go to delete dat file either
                                fs.readdir(delPathFolder, (err, files) => {

                                    for (var i = 0, len = files.length; i < len; i++) {
                                        console.log(files[i])
                                        if (files[i].startsWith(fileName + '.')) {
                                            res.end(apisRtnMsg.getRtnMsg(msgType.ok, scenario.delComm, 0))
                                            return
                                        }
                                    }

                                    // Del remote data file table rec
                                    console.log(`del file (.usrs)`)
                                    var tableName = comO.dbTblRemoteDataFiles.tblName
                                    var col = [comO.dbTblRemoteDataFiles.rdFileName, comO.dbTblRemoteDataFiles.foreign_usersInfoCertId]
                                    var colVal = [`\'` + fileName + comO.remoteDataFileSuffix + `\'`, `\'` + grantorCertId + `\'`]
                                    var queryCmd = sqlUtil.parserDelRecCmd(tableName, col, colVal)
                                    console.log(queryCmd)
                                    global.sqlConn.query(queryCmd, (error, results, fields) => {
                                        if (error) {
                                            checkDbErr(error.code)
                                        } else {
                                            // Del remote data file
                                            var delPathFolder = comO.saveRemoteDataFileDir + '/' + grantorCertId
                                            var delPath = delPathFolder + '/' + fileName + comO.remoteDataFileSuffix
                                            console.log(`Del file ${delPath}`)
                                            fs.unlink(delPath, (err) => {
                                                if (err) {
                                                    if (err.code === 'ENOENT') {
                                                        res.end(apisRtnMsg.getRtnMsg(msgType.err, scenario.delComm, 0))
                                                    }
                                                } else {
                                                    res.end(apisRtnMsg.getRtnMsg(msgType.ok, scenario.delComm, 0))
                                                }
                                            })
                                        }
                                    })
                                })
                            }
                        })
                    }
                })
            } else {
                res.end(apisRtnMsg.getRtnMsg(msgType.err, scenario.delComm, 0))
            }
        }
    })
}

// == Change password ===================================
router.route('/changepasswd')
    .put((req, res) => {

        console.log(`New pass: ${req.headers.new_passwd}`)

        if (req.headers.new_passwd == undefined) {
            res.end(apisRtnMsg.getRtnMsg(rtnMsgErr, rtnScenarioChangePasswd, 1))
            return
        }

        var decoded = jwt.verify(req.headers['x-access-token'], global.tokenSecretKey)
        console.log(decoded)

        var saltRounds = 10
        bcrypt.hash(req.headers.new_passwd, saltRounds, (err, hash) => {

            console.log(`bcrypt hash: ${hash}`)

            orm.userUpdatePassByCertId(decoded.sub, hash, result => {
                console.log(`userUpdatePassByCertId ${result}`)

                if (result)
                    res.end(apisRtnMsg.getRtnMsg(rtnMsgOk, rtnScenarioChangePasswd, 0))
                else
                    res.end(apisRtnMsg.getRtnMsg(rtnMsgErr, rtnScenarioChangePasswd, 0))
            })
        })
    })

// =====================================================
var checkDbErr = (errStr) => {
    if (errStr == 'ER_DUP_ENTRY') {
        var rtn = apisRtnMsg.getRtnMsg(msgType.err, scenario.db, 0)
    } else if (errStr == 'ER_BAD_FIELD_ERROR') {
        var rtn = apisRtnMsg.getRtnMsg(msgType.err, scenario.db, 1)
    } else if (errStr == 'ER_NO_REFERENCED') {
        var rtn = apisRtnMsg.getRtnMsg(msgType.err, scenario.db, 2)
    } else if (errStr == 'ER_PARSE_ERROR') {
        var rtn = apisRtnMsg.getRtnMsg(msgType.err, scenario.db, 3)
    } else if (errStr == 'ER_BAD_FIELD_ERROR') {
        var rtn = apisRtnMsg.getRtnMsg(msgType.err, scenario.db, 4)
    }
    return rtn
}

var sha1HashSync = (fileFullPath) => {
    try {
        var data = fs.readFileSync(fileFullPath)
    } catch (err) {
        console.log(`sha1HashSync err ${err}`)
    }
    return checksum(data, 'sha1')
}

var checksum = (str, algorithm, encoding) => {
    return crypto
        .createHash(algorithm || 'sha1')
        .update(str, 'utf8')
        .digest(encoding || 'hex')
}

module.exports = router;