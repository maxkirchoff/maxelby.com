var exports = module.exports = {};

// CONTACTS API ROUTES BELOW
// Generic error handler used by all endpoints.
exports.handleError = function(res, reason, message, code) {
  console.log("ERROR: " + reason);
  res.status(code || 500).json({"error": message});
  res.end();
}

// Cleans the payload of any extra data not needed
// in the context it's being used
exports.cleanPayload = function(payload, fields) {
  let cleanPayload = {};
  for (let i=0; i<fields.length; i++) {
    if (payload[fields[i]] !== undefined) {
      cleanPayload[fields[i]] = payload[fields[i]];
    }
  }
  return cleanPayload;
}

// validated that the required params exist
exports.validateRequiredParams = function(payload, requiredParams) {
  for( let i=0; i<requiredParams.length; i++) {
    if (payload[requiredParams[i]] !== undefined || payload[requiredParams[i]]) {
      return true;
    }
  }
}
