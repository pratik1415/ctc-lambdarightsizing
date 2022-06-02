'use strict';
/***********************************************************************
Note: Service will assume role to generate  credentials to perform actions
*************************************************************************/
const AWS = require("aws-sdk");
let sts = new AWS.STS();

/**
 * assume STS role
 * @returns 
 */
const assumeSTSRole = () => {
    return new Promise((resolve, reject) => {
        let role_To_Assume = "arn:aws:iam::465258079489:role/515756-Cost-optimization-SQS-Attachments-Role";
        var params = {
            RoleArn: role_To_Assume,
            RoleSessionName: "_VitalizeId-Decommissioned"

        };
        console.info(`[Info]: Assume role params :`, params);
        sts.assumeRole(params, (err, data) => {
            if (err) {
                if (err.code == "ThrottlingException" && err.message == "Rate exceeded") {
                    console.error(`[Error/Info]: AssumeRole Api is throttling, Calling after some time.`);
                    setTimeout(() => {
                        resolve(assumeSTSRole());
                    }, 300);
                }  else {
                    reject(err);
                }
            } else {
                    let session = {
                        'accessKeyId': data.Credentials.AccessKeyId,
                        'secretAccessKey': data.Credentials.SecretAccessKey,
                        'sessionToken': data.Credentials.SessionToken,
                        'expired': false
                    }
                    console.info('Successfully generated the temporary credentials');
					resolve(session);
            }
        });
    }); 
}
module.exports = { assumeSTSRole };