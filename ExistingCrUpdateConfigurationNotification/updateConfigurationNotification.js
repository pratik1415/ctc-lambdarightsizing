var AWS = require('aws-sdk');
var lambda = new AWS.Lambda();
var s3 = new AWS.S3()
var jsonexport = require('jsonexport');
const { insertNewCrMailPayloadToSqs } = require('./notificationForUpdatedCr');
const csv = require('csvtojson');
let rollBackDate = process.env.rollBackDate; //environment variable
let targetDate = process.env.TargetDate; //environment variable
let TargetDate = new Date(targetDate)
let currentDate = new Date().toISOString().split("T")[0]
TargetDate.setDate(TargetDate.getDate() + 1)
TargetDate = TargetDate.toISOString().split("T")[0];

class existingCrUpdate {
    init = async (event) => {
        console.log(":::::Update Event:::::", event)
        let lambdalist
        if (event.detail.responseElements != null) {
            lambdalist = event.detail.responseElements.functionName
        }
        else {
            lambdalist = event.detail.requestParameters.functionName
        }
        let getFunction = await this.getFunction(lambdalist);
        return 'done';
    }

    getFunction = async (listfunction) => {
        try {
            var params = {
                FunctionName: `arn:aws:lambda:${process.env.Region}:${process.env.AccountId}:function:${listfunction}`
               // FunctionName: `arn:aws:lambda:us-east-1:820784505615:function:${listfunction}`
            };
            let data = await lambda.getFunction(params).promise();
            console.log("data.Configuration.MemorySize", data.Configuration.MemorySize)

            if (data.Configuration.MemorySize > process.env.MaxMemorySize) {
                let sizing = await this.processForRightSizing(data, listfunction)
            }
            return data;
        }
        catch (err) {
            throw err;
        }
    }

    processForRightSizing = async (data, listfunction) => {
        try {
            let fnName = listfunction
            let accountId = (data.Configuration.FunctionArn).split(":")[4]
            let mem_size = data.Configuration.MemorySize
            let vitalizeId = data.Tags.VitalizeId != "undefined" ? data.Tags.VitalizeId : (data.Tags['cmdb:business-application'] != "undefined" ? data.Tags['cmdb:business-application'] : " ")
            let contact = data.Tags.Contact
            console.log("TargetDate:::", TargetDate, " currentDate::", currentDate, " Rollbackdate:::", rollBackDate)
            let tagKeys = Object.keys(data.Tags)
            if (tagKeys.indexOf("bms:memorythresholdexception1") > -1) {
                console.log("coming to tag value operations:::", data.Tags['bms:memorythresholdexception'])
                if (data.Tags['bms:memorythresholdexception'] < data.Configuration.MemorySize) {
                    console.log("Need to update")
                    var resizeLambdaParams = {
                        FunctionName: data.Configuration.FunctionName,
                        MemorySize: data.Tags['bms:memorythresholdexception'],
                    };
                    let resizeLambdaData = await lambda.updateFunctionConfiguration(resizeLambdaParams).promise()
                    let mail = await insertNewCrMailPayloadToSqs(fnName, accountId, mem_size, vitalizeId, contact, TargetDate)
                }
                else {
                    console.log("No need to update")
                }
            }
            else {
                console.log("coming to the whitelisted cr operations:::")
                if (TargetDate > currentDate) {
                    let initailWhitelistCr = await this.fetchInitialCRFile()
                    var resizeLambdaParams = {
                        FunctionName: data.Configuration.FunctionName,
                        MemorySize: process.env.MaxMemorySize,
                    };
                    let crExist = initailWhitelistCr.filter(i => i.FunctionName == listfunction);
                    console.log("Checking from initial whitelisted file::::::", crExist.length)
                    if (crExist.length <= 0) {
                        console.log("Function not whitelisted, processing for Update memory size::::::::")
                        let resizeLambdaData = await lambda.updateFunctionConfiguration(resizeLambdaParams).promise()
                        console.log("Function Updated Successfully::::::::")
                        let mail = await insertNewCrMailPayloadToSqs(fnName, accountId, mem_size, vitalizeId, contact, TargetDate)
                    }
                    else {
                        console.log("CR Whitelisted:::")
                    }
                }
                else {
                    let whiteListedContent = await this.fetchInputFile()
                    console.log("Checking from newly added whitelisted file::::::")
                    var resizeLambdaParams = {
                        FunctionName: data.Configuration.FunctionName,
                        MemorySize: process.env.MaxMemorySize,
                    };
                    let crExist = whiteListedContent.filter(i => i.FunctionName == listfunction);
                    if (crExist.length >= 0) {
                        console.log("Function not whitelisted, processing for Update memory size::::::::")
                        let resizeLambdaData = await lambda.updateFunctionConfiguration(resizeLambdaParams).promise()	
                        console.log("Function Updated Successfully::::::::")
                        let mail = await insertNewCrMailPayloadToSqs(fnName, accountId, mem_size, vitalizeId, contact, TargetDate)
                    }
                    else {
                        console.log("CR Whitelisted:::")
                    }
                }
            }
        }
        catch (exe) {
            console.log("Exception in processForRightSizing", exe)
        }
    }

    fetchInputFile = async () => {
        try {
            var keyName = process.env.LambdaConfigFileKey
            var params = {
                Bucket: process.env.DataAccountBucketName,
                Key: keyName
            };
            const stream = s3.getObject(params).createReadStream();
            const csvContent = await csv().fromStream(stream);
            return csvContent
        }
        catch (e) {
            console.log("exception in fetching input file")
        }
    }

    fetchInitialCRFile = async () => {
        try {
             var keyName = `CostOptimizationTestLambda/${process.env.AccountId}_ExistingAllambdaMemoryDetails.csv`
            var params = {
                Bucket: process.env.DataAccountBucketName,
                Key: keyName
            };
            const stream = s3.getObject(params).createReadStream();
            const initialCrDetails = await csv().fromStream(stream);
            return initialCrDetails
        }
        catch (e) {
            console.log("Exception in fetching initial cr file::::", e)
        }
    }
}


module.exports = { existingCrUpdate };

// async function getMetrics() {
//     var obj = new existingCrUpdate();
//     let event = {
//         Type: 'schedualEvent',
//         FunctionName: 'costOptimizationResizeLambda',
//         MemorySize: '1500',
//     }
//     let response = await obj.init(event);
// }
// getMetrics();