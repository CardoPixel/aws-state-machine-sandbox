// lambda/refundPayment.ts
import { Handler } from "aws-lambda";
import AWS from "aws-sdk";

const ddb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME || "";

export const handler: Handler = async (event) => {
  let orderDetails;

  try {
    orderDetails = JSON.parse(event.body);
  } catch (error) {
    console.error("Error parsing order details for refund:", error);
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: "Invalid request format for refunding. Details: " + error,
      }),
    };
  }

  const orderId = orderDetails.orderId;
  if (!orderId) {
    console.error("Order ID is missing for refund");
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Order ID is required for refunding." }),
    };
  }

  // Assuming refund logic is successful
  const refundSuccessful = true;

  if (!refundSuccessful) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Refund processing failed" }),
    };
  }

  // Update order status in DynamoDB to REFUNDED
  const updateParams = {
    TableName: TABLE_NAME,
    Key: { PK: `ORDER#${orderId}`, SK: `ORDER#${orderId}` },
    UpdateExpression: "set #status = :status",
    ExpressionAttributeNames: { "#status": "status" },
    ExpressionAttributeValues: { ":status": "REFUNDED" },
    ReturnValues: "UPDATED_NEW",
  };

  try {
    const result = await ddb.update(updateParams).promise();
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Payment refunded successfully for orderId " + orderId,
        result: result.Attributes,
      }),
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Error refunding payment:", errorMessage);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Failed to refund payment",
        error: errorMessage,
      }),
    };
  }
};
