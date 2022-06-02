var AWS = require('aws-sdk');
var lambda = new AWS.Lambda();
var s3 = new AWS.S3()
var jsonexport = require('jsonexport');
const { insertNewCrMailPayloadToSqs } = require('./notificationForNewCr');
const csv = require('csvtojson');

class rollBackNewCR {
    constructor(event, context, callback) {
        this.event = event;
        this.context = context;
        this.callback = callback;
    }

    init = async (event) => {
        console.log(":::::Inside Right Sizing Notification:::::")
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
            let whiteListedContent = await this.fetchInputFile()
            let crExist = whiteListedContent.filter(i => i.FunctionName == listfunction);
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
                }
                else {
                    console.log("No need to update")
                }
            }
            else {
                var resizeLambdaParams = {
                    FunctionName: data.Configuration.FunctionName,
                    MemorySize: process.env.MaxMemorySize,
                };

                if (crExist.length <= 0) {
                    console.log("resizeLambdaParams", resizeLambdaParams)
                    let resizeLambdaData = await lambda.updateFunctionConfiguration(resizeLambdaParams).promise()
                    console.log("Function Updated Successfully::::::::")
                    let mail = await insertNewCrMailPayloadToSqs(fnName, accountId, mem_size, vitalizeId, contact)
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

}


module.exports = { rollBackNewCR }
