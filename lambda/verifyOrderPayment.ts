// lambda/verifyOrderPayment.ts
import { Handler } from "aws-lambda";
import AWS from "aws-sdk";

const ddb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME || "";

export const handler: Handler = async (event: any) => {
  // Extract data from the event object
  let orderItems, orderId, customer, paymentId;
  try {
    const input = JSON.parse(event.body);
    orderId = input.orderDetails.orderId;
    orderItems = input.orderDetails.items;
    customer = input.orderDetails.customer;
    paymentId = input.orderDetails.payment.paymentId;
    if (!orderId) {
      console.error("OrderId is required");
      throw new Error("OrderId is required");
    }
  } catch (error) {
    console.error("Error parsing input:", error);
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: "Invalid input format or missing orderId, Details: " + error,
      }),
    };
  }

  try {
    // Fetch order and payment details from DynamoDB
    const orderParams = {
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `ORDER#${orderId}`,
        ":sk": "ITEM#",
      },
    };
    const paymentParams = {
      TableName: TABLE_NAME,
      Key: {
        PK: `PAYMENT#${paymentId}`,
        SK: `PAYMENT#${paymentId}`,
      },
    };

    const [orderResp, paymentResp] = await Promise.all([
      ddb.query(orderParams).promise(),
      ddb.get(paymentParams).promise(),
    ]);

    const items = orderResp.Items || [];
    const payment = paymentResp.Item;

    if (!payment || payment.payment.amount === undefined) {
      throw new Error("Payment information is missing or incomplete.");
    }

    // Calculate total price from items, ensuring result is a number
    const totalDue = items.reduce(
      (total, { price, quantity }) => total + price * quantity,
      0
    );
    const paymentAmount = parseFloat(payment.payment.amount);

    let status = "UNKNOWN",
      remainingAmount = 0,
      overpaidAmount = 0;
    if (paymentAmount === totalDue) {
      status = "PAID";
    } else if (paymentAmount < totalDue) {
      status = "UNDERPAID";
      remainingAmount = totalDue - paymentAmount;
    } else if (paymentAmount > totalDue) {
      status = "OVERPAID";
      overpaidAmount = paymentAmount - totalDue;
    }

    // Return the structured response expected by the state machine
    return {
      statusCode: 200,
      body: JSON.stringify({
        billId: `${new Date().toISOString()}#${orderId}`,
        dateIssued: new Date().toISOString(),
        customerName: customer?.name,
        customerTaxId: customer?.taxId,
        orderId,
        items: orderItems,
        totalDue,
        paymentReceived: paymentAmount,
        remainingAmount,
        overpaidAmount,
        status,
      }),
      status: status,
    };
  } catch (error) {
    console.error("Error verifying order payment:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Failed to verify order payment. Details: " + error,
        error: String(error),
      }),
    };
  }
};
