const { oversizedNotification } = require('./ExistingCrNotification/oversizedNotification');
const { existingCrUpdate } = require('./ExistingCrUpdateConfigurationNotification/updateConfigurationNotification');
const { rollBackNewCR } = require('./NewCrNotification/rightSizeConfigurationForNewFunction');

exports.handler = async (event, context, callback) => {
    console.log("Inside Index.js and event:::", event)
    try {
        if (event['detail-type'] == 'Scheduled Event') {
            console.log("::::Inside Existing CR Configuration Notification:::::::::::")
            var obj1 = new oversizedNotification(event, context, callback);
            await obj1.init(event);
        }
        else if (event.detail.eventName == 'CreateFunction20150331' ) {
            console.log("::::::Inside New CR Configuration Notification:::::::")
            var obj2 = new rollBackNewCR(event, context, callback);
            await obj2.init(event);
        } 
         else if (event.detail.eventName == 'UpdateFunctionConfiguration20150331v2') {
            console.log(":::::Inside Existing CR Update Configuration Notification::::::")
            var obj3 = new existingCrUpdate(event, context, callback);
            await obj3.init(event);
        }
        else {
            console.log("No event found")
        }

    } catch (error) {
        console.error('Error from handler file', error.name, error.message, error);
        callback(error, null);
    }
}; 