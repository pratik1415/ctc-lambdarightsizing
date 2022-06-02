var AWS = require('aws-sdk');
var lambda = new AWS.Lambda({ region: "us-east-1" });
var s3 = new AWS.S3({ region: "us-east-1" })
var jsonexport = require('jsonexport');
const { insertMailPayloadToSqs } = require('./notification.js');
const { reminder } = require('../ReminderNotification/reminderNotification.js')
const { confirmationMail } = require('../ConfirmationNotification/notification.js')
const { assumeSTSRole } = require('../stsService');
const { putCsvFileToS3 } = require('../s3Service');
var lambdaMemoryDetails = []
var allLambdaArray = []
var succefullyRollBackedDataArray = []
const csv = require('csvtojson');
let rollBackDate = process.env.rollBackDate; //environment variable
let targetDate = process.env.TargetDate; //environment variable
let TargetDate = new Date(targetDate)
TargetDate.setDate(TargetDate.getDate() + 1)
TargetDate = TargetDate.toISOString().split("T")[0];
let currentDate = new Date().toISOString().split("T")[0]
let notificationDate = targetDate
var reminderDate = new Date(notificationDate);
reminderDate.setDate(reminderDate.getDate() - 2);
let TargetDate1 = new Date(targetDate)
TargetDate1 = TargetDate1.toISOString().split("T")[0];

class oversizedNotification {
    init = async () => {
        console.log(":::::Inside OversizedNotification:::::")
        console.log("currentDate::", currentDate, "reminderDate::", reminderDate.toISOString().split("T")[0], "targetDate::", TargetDate)
         let listfunction = await this.listfunction({}, [])
        var call = await this.recurrsion(listfunction, 0)
        if (rollBackDate == currentDate) {
            let lambdaMemoryDetailsCSV = await jsonexport(allLambdaArray)
            let lambdaMemoryDetailsCSVendToS3 = await this.sendRecords(lambdaMemoryDetailsCSV, 'ExistingAllambdaMemoryDetails')
        }
        let groupData = await this.groupByOperation(lambdaMemoryDetails)
        const tempCredentials = await assumeSTSRole();
        let attachment = await this.csvgeneration(groupData,tempCredentials)
        if (TargetDate == currentDate) {
            let rollBackedDetailsCSV = await jsonexport(lambdaMemoryDetails)
            let lambdaMemoryDetailsCSVendToS31 = await this.sendRecords(rollBackedDetailsCSV, `CRRollBackedDetailsCSV-${currentDate}`)
        }
        return 'done';
    }

    listfunction = async (params, lambdalist) => {
        try {
            let items = await lambda.listFunctions(params).promise();
            items.Functions.forEach((Lambdaname) => lambdalist.push(Lambdaname.FunctionName));
            if (items.NextMarker) {
                params.Marker = items.NextMarker;
                return this.listfunction(params, lambdalist)
            } else {
                return lambdalist;
            }
        } catch (error) {
            throw error;
        }
    };

    recurrsion = async (lambdalist, i) => {
        console.log(" ")
        console.log("Inside recurrsion", i);
        try {
            if (i < lambdalist.length) {
                let getFunction = await this.getFunction(lambdalist[i]);
                return this.recurrsion(lambdalist, ++i)
            } else {
                return "done"
            }
        } catch (exe) {
            console.log("exe in recurrsion", exe)
        }
    }

    getFunction = async (listfunction) => {
        try {
            var params = {
                FunctionName: `arn:aws:lambda:${process.env.Region}:${process.env.AccountId}:function:${listfunction}`
            };
            let data = await lambda.getFunction(params).promise();
            //console.log(data.Configuration.MemorySize)
            let allLambdaObje = {}
            allLambdaObje.FunctionName = listfunction
            allLambdaObje.MemorySize = data.Configuration.MemorySize
            allLambdaObje.accountId = (data.Configuration.FunctionArn).split(":")[4]
            allLambdaObje.Region = (data.Configuration.FunctionArn).split(":")[3]
            allLambdaArray.push(allLambdaObje)
            if (data.Configuration.MemorySize >  process.env.MaxMemorySize) {
                let notificationProcess = await this.processForMakeCSVDetailsArray(data, listfunction)
            }
            return;
        } catch (err) {
            console.log("error in getfunction::", err)
            throw err;
        }
    }

    processForMakeCSVDetailsArray = async (data, listfunction) => {
        try {
            let fnName = listfunction
            let accountId = (data.Configuration.FunctionArn).split(":")[4]
            let mem_size = data.Configuration.MemorySize
            let vitalizeId = data.Tags.VitalizeId != "undefined" ? data.Tags.VitalizeId : (data.Tags['cmdb:business-application'] != "undefined" ? data.Tags['cmdb:business-application'] : " ")
            let contact = data.Tags.Contact
            let region = (data.Configuration.FunctionArn).split(":")[3]
            let tags = data.Tags
            let runtime = data.Configuration.Runtime
            var contactDetails = {}
            let csvContent = await this.fetchInputFile()
            let crExist = csvContent.filter(i => i.FunctionName == listfunction);
            //console.log("crExist", crExist)
            //if (crExist.length <= 0 || data.Tags['CTC:Test']!='Working') {
            if (crExist.length <= 0) {
 
                contactDetails.VitalizeId = vitalizeId
                contactDetails.accountId = accountId
                contactDetails.FunctionName = fnName
                contactDetails.Region = region
                contactDetails.MemorySize = mem_size
                contactDetails.Runtime = runtime
                contactDetails.Contact = contact;
                contactDetails.TargetDate = TargetDate1
                contactDetails.Tags = JSON.stringify(tags)
                lambdaMemoryDetails.push(contactDetails)
            }
            return;
        } catch (exe) {
            console.log("exception in processForMakeCSVDetailsArray::::", exe)
        }
    }

    groupByOperation = async (groupByOperation) => {
        try {
            function groupByKey(array, key) {
                return array
                    .reduce((hash, obj) => {
                        if (obj[key] === undefined) return hash;
                        return Object.assign(hash, {
                            [obj[key]]: (hash[obj[key]] || []).concat(obj)
                        });
                    }, {});
            }

            let groupedData = groupByKey(groupByOperation, "Contact")
            return groupedData
        } catch (e) {
            console.log("exception in groupByOperation", e)
        }
    }


    csvgeneration = async (details,tempCredentials) => {
        try {
            let succefullyRollBackedData = {}
            let b = Object.keys(details)
            //console.log("b", details)
            if (b.length > 0) {
                for (let keys of b) {
                    console.log(" ")
                     let csv = await jsonexport(details[keys]);
                    let attachmentFile = await putCsvFileToS3(keys, csv, tempCredentials)
                    console.log("attachmentFile::::", attachmentFile)
                    if (process.env.notification == 'true') {
                        let mail = await insertMailPayloadToSqs(keys, TargetDate1, attachmentFile);
                    } else if ((reminderDate.toISOString().split("T")[0]) == currentDate) {
                        console.log("Reminder")
                        let reminderNotification = await reminder(keys, attachmentFile, TargetDate1)
                    } else if (TargetDate == currentDate) {
                         console.log("  ")
                        console.log("confirmation")
                        for (let i of details[keys]) {
                            let funTags = JSON.parse(i.Tags)
                            let tagKeys = Object.keys(funTags)
                            if (tagKeys.indexOf("bms:memorythresholdexception") > -1) {
                                console.log("Checking Tags Value:::")
                                if (funTags['bms:memorythresholdexception'] < i.MemorySize) {
                                    console.log("Memory Size is more than Tag Value")
                                    var resizeLambdaParams = {
                                        FunctionName: i.FunctionName,
                                        MemorySize: funTags['bms:memorythresholdexception'],
                                    };
                                    console.log("resizeLambda Params from Tag Operations",resizeLambdaParams)
                                    let resizeLambdaData = await lambda.updateFunctionConfiguration(resizeLambdaParams).promise()
                                } else {
                                    console.log("No need to update")
                                }
                            } else {
                                console.log("Downsizing to Directly 1GB::::")
                                var resizeLambdaParams = {
                                    FunctionName: i.FunctionName,
                                    MemorySize: process.env.MaxMemorySize,
                                };
                                console.log("resizeLambda Params from Direct Downsized Operations", resizeLambdaParams)
                               let resizeLambdaData = await lambda.updateFunctionConfiguration(resizeLambdaParams).promise()
                            }
                        }
                        let mail = await confirmationMail(keys, TargetDate1, attachmentFile);
                    } else {
                        console.log("::No need to notify:::::")
                    }
                }
                var params = { FunctionName: process.env.functionName };
                let envData = await lambda.getFunctionConfiguration(params).promise()
                let environments = envData['Environment']
                environments['Variables']['notification'] = 'false'
                var resizeLambdaParams1 = {
                    FunctionName: process.env.functionName,
                    Environment: environments
                };
                console.log("resizeLambdaParams", resizeLambdaParams1)
                let resizeLambdaData = await lambda.updateFunctionConfiguration(resizeLambdaParams1).promise()
            }
            return;
        } catch (err) {
            console.log("[ERROR] : csvgeneration catch error info :: ", JSON.stringify(err));
            throw err;
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
        } catch (e) {
            console.log("exception in fetching input file", e)
        }
    }

    sendRecords = async (csv, filename) => {
        try {
            let keyDate = new Date().toISOString().split("T")[0]
            var keyName = `CostOptimizationTestLambda/${process.env.AccountId}_${filename}.csv`
            var params = {
                Body: csv,
                Bucket: process.env.DataAccountBucketName,
                Key: keyName
            };
            //console.log("params of send Records", params)
            let data = await s3.putObject(params).promise();
            console.log("done")
            return data;
        }
        catch (exe) {
            console.log('---exception in doAsumceRole of createRuleRecursion---', exe);
        }
    }
}

module.exports = { oversizedNotification }

// async function getMetrics() {
//     var obj = new oversizedNotification();
//     let response = await obj.init();
// }

// getMetrics();


