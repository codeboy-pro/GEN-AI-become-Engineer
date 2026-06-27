import readlinesync from "readline-sync";

async function get_crypto_price(coin) {
  const response = await fetch(
    `https://api.coingecko.com/api/v3/coins/${coin}`,
  );
  const data = await response.json();
  console.log(data);
}

const question = readlinesync.question("Enter the name of the coin: ");
get_crypto_price(question);
