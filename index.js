var AWS = require("aws-sdk");
const { Pool } = require('pg');  //  Needs the nodePostgres Lambda Layer.

const PROD_MODE = true;
const DEV_USERNAME = 'nuttdrive@gmail.com';
const SYSTEM_CODE = '02';
const PRIVILEGE_CODE = '5.1.1';
const PG_DB = "master"
const PG_SCHEMA = "stock"
const TABLE_PRODUCTION_ORDER = 'production_order'
const TABLE_PRODUCTION_ORDER_ITEM = 'production_order_item'
const TABLE_PRODUCTION_ORDER_ITEM_DETAIL = 'production_order_item_detail'

let docClient = new AWS.DynamoDB.DocumentClient();
const pool = new Pool();
const createPDF = require('./createPDF')
const s3 = new AWS.S3();


exports.handler = async (event, context) => {
    console.log("event => ", event);
    context.callbackWaitsForEmptyEventLoop = false; // !important to reuse pool

    // Get Username from header
    const username = PROD_MODE ? getUsername(event.requestContext) : DEV_USERNAME;
    if (username == null) {
        doResponse(context, 401, { message: "Unauthorize user " })
        return
    }

    // Get UserSession from DynamoDB
    const userSession = await getUserSession(username, SYSTEM_CODE);
    if (userSession.error != null) {
        doResponse(context, 401, userSession.error)
        return
    }
    const warehouseCode = userSession.data.selectedWarehouseCode;

    // Check User Permission from DynamoDB
    const hasPermission = await checkPermission(username, SYSTEM_CODE, PRIVILEGE_CODE);
    if (hasPermission.error != null) {
        doResponse(context, 401, hasPermission.error)
        return
    }

    const { moNumber } = event.pathParameters != null ? event.pathParameters : { moNumber: null }
    console.log('moNumber => ', moNumber)

    if (moNumber == null) {
        doResponse(context, 401, { message: 'moNumber not found.' })
        return
    }

    // Start Business Logic here
    const client = await pool.connect();
    let productionOrderRes;
    let new_productionOrderRes;
    let responsePDF
    try {
        // Get production_order by user's warehouse
        console.log("query production_order by moNumber and warehouseCode");
        const params = queryProductionOrderWithMoNumber(moNumber)
        productionOrderRes = await client.query(params.text, params.value);

        if (productionOrderRes.rowCount == 0) {
            throw { message: 'moNumber not found.' }
        }

        const { statusCode } = productionOrderRes.rows[0]

        if (statusCode != 'ISS') {
            throw { message: 'cannot get pdf production order' }
        }

        // Get production_order_item by user's warehouse and moNumber
        console.log("query production_order_item by moNumber");
        const paramsProductionOrderItem = queryProductionOrderItemWithMoNumber(moNumber)
        let productionOrderItemRes = await client.query(paramsProductionOrderItem.text, paramsProductionOrderItem.value);
        //set data for pdf
        console.log('set data for pdf file')
        new_productionOrderRes = productionOrderRes.rows[0]
        new_productionOrderRes.bomItems = productionOrderItemRes.rows

        console.log('query production_order_item_detail by moNumber and productItemCode');
        for (let i = 0; i < new_productionOrderRes.bomItems.length; i++) {
            // query production_order_item_detail
            const { productItemCode } = new_productionOrderRes.bomItems[i]
            const paramQueryProductionOrderItemDetail = queryProductionOrderItemDetailWithMoNumber(moNumber, productItemCode)
            let productionOrderItemDetailRes = await client.query(paramQueryProductionOrderItemDetail.text, paramQueryProductionOrderItemDetail.value)
            new_productionOrderRes.bomItems[i].details = productionOrderItemDetailRes.rows || []
            new_productionOrderRes.bomItems[i].seq = i + 1
        }

        console.log('new_productionOrderRes => ', new_productionOrderRes);

        const createPDFRes = await createPDF.genFilePDFAndUploadPDF(new_productionOrderRes)
        console.log('createPDFRes => ', createPDFRes);

        console.log('get Signed Url 180 sec.')
        const url = await getSignedUrl(createPDFRes.key, 180)
        console.log('url => ', url)


         //set response
         console.log("set response");
        responsePDF = {
            fileUrl: url || '',
            key: createPDFRes.key || ''
        }
    } catch (err) {
        console.log('catch err => ', err);
        doResponse(context, 401, err)
        return
    }
    finally {
        client.release(true);
    }

    const response = {
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
        },
        statusCode: 200,
        body: JSON.stringify(responsePDF),
    };
    console.log("response: ", response);
    return response;
};


async function getSignedUrl(key, expires) {
    const param = { Bucket: 'test.import.excel', Key: key, Expires: expires };
    return new Promise(function (resolve, reject) {
        s3.getSignedUrl('getObject', param, (err, url) => {
            if (err) {
                console.log('getSignedUrl error => ', err)
                reject(err)
            }
            resolve(url);
        })
    });
}

function queryProductionOrderWithMoNumber(moNumber) {
    const queryText = `select *
    from ${PG_DB}.${PG_SCHEMA}.${TABLE_PRODUCTION_ORDER}
    where "moNumber" = $1;`
    const query = {
        text: queryText,
        value: [moNumber]
    }
    return query
}

function queryProductionOrderItemWithMoNumber(moNumber) {
    const queryText = `select *
    from ${PG_DB}.${PG_SCHEMA}.${TABLE_PRODUCTION_ORDER_ITEM}
    where "moNumber" = $1;`
    const query = {
        text: queryText,
        value: [moNumber]
    }
    return query
}

function queryProductionOrderItemDetailWithMoNumber(moNumber, productItemCode) {
    const queryText = `select "quantity" , "expiredDate"
    from ${PG_DB}.${PG_SCHEMA}.${TABLE_PRODUCTION_ORDER_ITEM_DETAIL}
    where "moNumber" = $1 and "productItemCode" = $2;`
    const query = {
        text: queryText,
        value: [moNumber, productItemCode]
    }
    return query
}

function doResponse(context, statusCode, err) {
    const newError = {
        message: err.message || 'error'
    }
    const response = {
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
        },
        statusCode: statusCode,
        body: JSON.stringify(newError)
    }
    context.succeed(response)
}


function getUsername(requestContext) {
    try {
        const claims = requestContext.authorizer.claims;
        const username = claims['cognito:username'];
        return username
    } catch (err) {
        console.log("getUsername:", err);
        return null;
    }
}

function buildExpressionByUsernameAndSystemCode(username, systemCode, tableName) {
    let params = {
        TableName: tableName,
        KeyConditionExpression: "#user = :u and #code = :c",
        ExpressionAttributeNames: {
            "#user": "username",
            "#code": "systemCode"
        },
        ExpressionAttributeValues: {
            ":u": username,
            ":c": systemCode
        }
    }

    return params
}

function buildRolePrivilegeExpression(roleKey, rolePrivilegeCode) {
    let params = {
        TableName: "RolePrivilege",
        KeyConditionExpression: "#rk = :r and #cc = :c ",
        FilterExpression: "#alw = :al",
        ExpressionAttributeNames: {
            "#rk": "roleKey",
            "#cc": "code",
            "#alw": "allow"
        },
        ExpressionAttributeValues: {
            ":r": roleKey,
            ":c": rolePrivilegeCode,
            ":al": 'Y'
        }
    };

    return params
}

async function getUserSession(username, systemCode) {
    console.log("getUserSession: ", username, systemCode);
    try {
        const user_session_query = await docClient.query(buildExpressionByUsernameAndSystemCode(username, systemCode, 'UserSession')).promise();
        console.log("UserSession: ", user_session_query);
        if (user_session_query.Count == 1) {
            if (user_session_query.Items[0] && user_session_query.Items[0].sessionProperty) {
                console.log("SessionProperty: ", user_session_query.Items[0].sessionProperty);
                return {
                    data: user_session_query.Items[0].sessionProperty,
                    error: null
                }
            } else {
                return {
                    data: null,
                    error: {
                        message: 'Warehouse not found.'
                    }
                }
            }
        } else {
            return {
                data: null,
                error: {
                    message: 'Username not found.'
                }
            }
        }
    } catch (err) {
        console.log(err);
        return {
            data: null,
            error: err
        }
    }
}

async function checkPermission(username, systemCode, rolePrivilegeCode) {
    console.log("checkPermission:", username, systemCode, rolePrivilegeCode);
    try {
        const user_role_query = await docClient.query(buildExpressionByUsernameAndSystemCode(username, systemCode, "UserRole")).promise();
        if (user_role_query.Count == 1) {
            if (user_role_query.Items[0] && user_role_query.Items[0].roleKey) {
                const roleKey = user_role_query.Items[0].roleKey
                try {
                    const privilege_query = await docClient.query(buildRolePrivilegeExpression(roleKey, rolePrivilegeCode)).promise();
                    if (privilege_query.Count == 1) {
                        return {
                            data: privilege_query.Items[0],
                            error: null
                        }
                    } else {
                        return {
                            data: null,
                            error: {
                                message: "Unauthorize user, " + username
                            }
                        }
                    }

                } catch (err) {
                    return {
                        data: null,
                        error: err
                    }
                }
            } else {
                return {
                    data: null,
                    error: {
                        message: "Unauthorize user, " + username
                    }
                }
            }
        } else {
            return {
                data: null,
                error: {
                    message: "Unauthorize user, " + username
                }
            }
        }
    } catch (err) {
        console.log(err);
        return {
            data: null,
            error: err
        }
    }
}