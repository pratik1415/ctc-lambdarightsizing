'use strict';
const fs = require('fs');
const path = require('path');
const aws = require('aws-sdk');
const sqs = new aws.SQS();


    const confirmationMail = (keys,TargetDate,attachmentFile) => {
        console.log("::::Inside Sent Notification:::::")
        return new Promise((resolve, reject) => {
       // try {
            console.log("Contact",keys)
            console.log("attachmentFile",attachmentFile)
            let sqsPayLoad = {
                'Type': 'Email',
                'VitalizeId': '515756',
                'From': 'mg-aws-enforcer-support@bms.com',
                'To':keys,
                 "Attachment": attachmentFile
            };
            sqsPayLoad['Subject'] = `LAMBDA MEMORY DOWNSIZED NOTIFICATION`;
            const emailTextPayloadObj = fs.readFileSync(path.resolve(__dirname, './mailTemplate.txt'));
            let emailTextPayload = emailTextPayloadObj.toString();
             const mapObj = {
                targetDate: TargetDate
            };

            emailTextPayload = emailTextPayload.replace(/\b(?:targetDate)\b/gi, matched => mapObj[matched]);

            sqsPayLoad['Message'] = emailTextPayload;
            sqsPayLoad['SQSUrl'] = "https://sqs.us-east-1.amazonaws.com/820784505615/v428096-Centralised-Service-DeadLetter-SQS-dev";
            let params = {
                MessageBody: JSON.stringify(sqsPayLoad),
                QueueUrl: "https://sqs.us-east-1.amazonaws.com/465258079489/v428096-Centralised-Service-SQS-prod"
            };
            console.info('params of sqs', params);
            sqs.sendMessage(params,(err,data)=>{
                if(err){
                    console.log("err", err);
                }else{
                    console.log("mail sent data", data)
                    resolve('true')
                }
            })
    })
};

module.exports = { confirmationMail };