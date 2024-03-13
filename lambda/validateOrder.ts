// lambda/validateOrder.ts
import { Handler } from "aws-lambda";

export const handler: Handler = async (event: any) => {
  try {
    const { orderId, customer, items, payment } = JSON.parse(event.body);

    if (!orderId || !customer || items.length === 0 || !payment) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          validationStatus: "FAILED",
          message: "Missing or invalid order details.",
        }),
        validationStatus: "FAILED",
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        validationStatus: "PASSED",
        message: "Order is valid.",
        orderId,
      }),
      validationStatus: "PASSED",
    };
  } catch (error) {
    return {
      statusCode: 200,
      body: JSON.stringify({
        validationStatus: "FAILED",
        message: "Validation error.",
        error: String(error),
      }),
      validationStatus: "FAILED",
    };
  }
};
