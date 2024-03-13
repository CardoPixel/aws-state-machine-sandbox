// lambda/cancelOrder.ts
import { Handler } from "aws-lambda";
import AWS from "aws-sdk";

const ddb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME || "";

interface CancelOrderEvent {
  Payload: {
    statusCode: number;
    body: string;
  };
}

export const handler: Handler<CancelOrderEvent> = async (event) => {
  // Try to parse the order ID from the event Payload
  let orderDetails;
  try {
    if (event.Payload && event.Payload.body) {
      orderDetails = JSON.parse(event.Payload.body);
    } else {
      throw new Error("Payload body is missing");
    }
  } catch (error) {
    console.error("Error parsing order details for cancellation:", error);
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: "Invalid request format for cancellation. Details: " + error,
      }),
    };
  }

  const orderId = orderDetails.orderId;
  if (!orderId) {
    console.error("Order ID missing for cancellation");
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: "Order ID is required for cancellation",
      }),
    };
  }

  const updateParams = {
    TableName: TABLE_NAME,
    Key: { PK: `ORDER#${orderId}`, SK: `ORDER#${orderId}` },
    UpdateExpression: "set #status = :status",
    ExpressionAttributeNames: { "#status": "status" },
    ExpressionAttributeValues: { ":status": "CANCELLED" },
    ReturnValues: "UPDATED_NEW",
  };

  try {
    const result = await ddb.update(updateParams).promise();
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Order cancelled successfully",
        orderId: orderId,
        result: result.Attributes,
      }),
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Error cancelling order:", errorMessage);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Failed to cancel order",
        error: errorMessage,
      }),
    };
  }
};
