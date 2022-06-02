'use strict';
const fs = require('fs');
const path = require('path');
const aws = require('aws-sdk');
const sqs = new aws.SQS();


//const insertMailPayloadToSqs = (fnName, accountId, mem_size, vitalizeId) => {
    const insertNewCrMailPayloadToSqs = (fnName,accountId,mem_size,vitalizeId,contact) => {
        console.log("::::Inside Sent Notification:::::")
    return new Promise(async (resolve, reject) => {
        try {
            console.log("fnName",fnName)
            console.log("accountID",accountId)
            console.log("Memory Size",mem_size)
            console.log("Vitalize Id",vitalizeId)
            console.log("Contact",contact)
            let sqsPayLoad = {
                'Type': 'Email',
                'VitalizeId': '515756',
                'From': 'mg-aws-enforcer-support@bms.com',
                'To': contact
            };
            sqsPayLoad['Subject'] = `${fnName} MEMORY OVERSIZED NOTIFICATION`;
            const emailTextPayloadObj = fs.readFileSync(path.resolve(__dirname, './mailTemplateToOwner.txt'));
            let emailTextPayload = emailTextPayloadObj.toString();
            const mapObj = {
                lambdaname: fnName,
                accountId: accountId,
                mem_size: mem_size,
                vitalizeId: vitalizeId,
                LAMBDA12 : fnName
            };

            emailTextPayload = emailTextPayload.replace(/\b(?:lambdaname|accountId|mem_size|vitalizeId|LAMBDA12)\b/gi, matched => mapObj[matched]);
            sqsPayLoad['Message'] = emailTextPayload;
            sqsPayLoad['SQSUrl'] = "https://sqs.us-east-1.amazonaws.com/820784505615/v428096-Centralised-Service-DeadLetter-SQS-dev";
            //"https://sqs.us-east-1.amazonaws.com/465258079489/v428096-Centralised-Service-DeadLetter-SQS-prod";
            let params = {
                MessageBody: JSON.stringify(sqsPayLoad),
                QueueUrl: "https://sqs.us-east-1.amazonaws.com/465258079489/v428096-Centralised-Service-SQS-prod"
            };
            console.info('params of sqs', params);
            let data = await sqs.sendMessage(params).promise();
            console.log("mail sent data", data);
            console.log('mail sent');
            resolve('true');
        } catch (e) {
            console.log("this is the issue", e);
            resolve('false');
        }
    })
};

module.exports = { insertNewCrMailPayloadToSqs };