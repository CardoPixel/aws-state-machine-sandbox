// lambda/payment.ts
import axios from "axios";
import { Handler } from "aws-lambda";
import AWS from "aws-sdk";

const ddb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME || "";

// Defining the expected structure of the response from the Random Number API
type RandomNumberApiResponse = number[];

export const handler: Handler = async (event: any) => {
  let orderDetails;

  try {
    if (!event.orderId) {
      const parsedEvent = JSON.parse(event.body);
      orderDetails = parsedEvent;
    } else {
      orderDetails = event;
    }

    if (!orderDetails.orderId) {
      throw new Error("Order ID is missing in the provided details");
    }
  } catch (error) {
    console.error("Error parsing input or missing orderId/paymentId:", error);
    return {
      statusCode: 400,
      body: JSON.stringify({
        message:
          "Order ID is required for payment processing and was not provided. Details: " +
          error,
      }),
    };
  }

  // Request a random number from the API to determine payment success
  const response = await axios.get<RandomNumberApiResponse>(
    `http://www.randomnumberapi.com/api/v1.0/random?min=1&max=100&count=1`
  );
  const randomNumbers = response.data;
  const paymentSuccessful = true;
  //const paymentSuccessful = randomNumbers[0] % 2 !== 0; // Payment is successful if the number is odd

  if (!paymentSuccessful) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Payment processing failed due to even random number.",
      }),
    };
  }

  // Update order status to PAID in DynamoDB
  const orderUpdateParams = {
    TableName: TABLE_NAME,
    Key: {
      PK: `ORDER#${orderDetails.orderId}`,
      SK: `ORDER#${orderDetails.orderId}`,
    },
    UpdateExpression: "set #status = :status",
    ExpressionAttributeNames: { "#status": "status" },
    ExpressionAttributeValues: { ":status": "PAID" },
    ReturnValues: "UPDATED_NEW",
  };

  // Update payment record status to SUCCESS in DynamoDB
  const paymentUpdateParams = {
    TableName: TABLE_NAME,
    Key: {
      PK: `PAYMENT#${orderDetails.payment.paymentId}`,
      SK: `PAYMENT#${orderDetails.payment.paymentId}`,
    },
    UpdateExpression: "set #status = :status",
    ExpressionAttributeNames: { "#status": "status" },
    ExpressionAttributeValues: { ":status": "SUCCESS" },
    ReturnValues: "UPDATED_NEW",
  };

  try {
    // Perform both updates in parallel
    await Promise.all([
      ddb.update(orderUpdateParams).promise(),
      ddb.update(paymentUpdateParams).promise(),
    ]);
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Payment processed successfully for orderId ${orderDetails.orderId}`,
        orderDetails,
      }),
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Error processing payment:", errorMessage);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Failed to process payment",
        error: errorMessage,
      }),
    };
  }
};
