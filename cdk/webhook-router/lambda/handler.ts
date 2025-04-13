import { helperFunction } from "./utils/helper";

export const handler = async (event: any) => {
  console.log("================================================");
  console.log("event:", event);
  const message = helperFunction();
  return {
    statusCode: 200,
    body: JSON.stringify({ message }),
  };
};
