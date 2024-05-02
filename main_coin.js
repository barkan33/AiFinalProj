import Papa from 'papaparse';
import { divide, mean, subtract, abs, max, log } from 'mathjs';


const data = [];

let maxPriceETH;
let maxPriceBTC;

async function main() {
  await GetDatafromCSV("./res/dataset.csv");

  let networkOptions = {
    hiddenLayers: [512, 256, 128],
    inputSize: 2,
    outputSize: 2
  };


  // create network options
  const net = new brain.NeuralNetwork(networkOptions);

  let normalizedData = normalizeData(data);
  // normalizedData = normalizedData.slice(1200, normalizedData.length);
  const { trainData, validationData, testData } = splitData(normalizedData, 1);

  let tempTrainData = trainData.map(element => ({ input: { Price_BTC: element.Price_BTC, Volume_BTC: element.Volume_BTC }, output: { Price_ETH: element.Price_ETH, Volume_ETH: element.Volume_ETH } }));

  let tempTestData = trainData.map(element => ({ input: { Price_BTC: element.Price_BTC, Volume_BTC: element.Volume_BTC }, output: { Price_ETH: element.Price_ETH, Volume_ETH: element.Volume_ETH } }));


  net.train(tempTrainData, {
    errorThresh: 0.025,
    iterations: 10000,
    log: true,
    logPeriod: 500
  });

  // console.log(denormalizeData([trainData[700]])[0]);
  // console.log(denormalizeData([tempTestData[700].input])[0]);
  // const predictedData = net.run(tempTestData[700].input); 
  // const denormalizedPrediction = denormalizeData([predictedData])[0];
  // console.log(denormalizedPrediction);




  document.querySelector('#netPrice').innerHTML = brain.utilities.toSVG(net);

  const pricePerformance = PricePerformance(net, tempTestData);
  console.log("Price Diff = " + pricePerformance);
  const mse = evaluatePerformance(net, tempTestData) * 100;
  console.log("NotReallyMSE = " + mse + "%");

}



main();



function PricePerformance(net, testData) {
  let avg = [];
  for (let i = 0; i < testData.length; i++) {
    const input = testData[i].input;
    const actual = testData[i].output;
    const predicted = net.run(input);
    const error = abs(subtract(+predicted.Price_ETH * maxPriceETH, +actual.Price_ETH * maxPriceETH));
    avg.push(error);
  }
  const mse = mean(avg);
  return mse;
}


// + == parseInt()
async function GetDatafromCSV(FilePath) {
  return new Promise((resolve, reject) => { // פונקציה של ג'ווה סקריפט שיודעת להבטיח שמשהו יקרה אם הוא אסינכרוני
    Papa.parse(FilePath, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        results.data.forEach(element => {
          data.push({
            Date: element.Date,
            Price_BTC: +element.Price_BTC,
            Volume_BTC: +element.Volume_BTC,
            Price_ETH: +element.Price_ETH,
            Volume_ETH: +element.Volume_ETH,
            Price_USDT: +element.Price_USDT,
            Volume_USDT: +element.Volume_USDT,
            Price_BNB: +element.Price_BNB,
            Volume_BNB: +element.Volume_BNB
          });
        });
        resolve(data); //מעבירים את המערך המוכן, והפונקציה יודעת להחזיר אותו למעלה
      },
      error: (error) => reject(error)
    });
  });
}

//מנרמל את הנתונים על ידי חלוקת כל ערך בערך המרבי של אותה עמודה במערך הנתונים.
function normalizeData(data) {
  maxPriceETH = max(data.map(el => +el.Price_ETH));
  maxPriceBTC = max(data.map(el => +el.Price_BTC));
  const normalizedData = data.map(element => {
    const input = {
      Date: element.Date,
      Price_BTC: divide(+element.Price_BTC, maxPriceBTC),
      Volume_BTC: divide(+element.Volume_BTC, max(data.map(el => +el.Volume_BTC))),
      Price_ETH: divide(+element.Price_ETH, maxPriceETH),
      Volume_ETH: divide(+element.Volume_ETH, max(data.map(el => +el.Volume_ETH))),
      Price_BNB: divide(+element.Price_BNB, max(data.map(el => +el.Price_BNB))),
      Volume_BNB: divide(+element.Volume_BNB, max(data.map(el => +el.Volume_BNB)))
    };
    return input;
  });
  return normalizedData;
}
function denormalizeData(data) {
  const denormalizedData = data.map(element => {
    const output = {
      Date: element.Date,
      Price_BTC: element.Price_BTC * maxPriceBTC,
      Volume_BTC: element.Volume_BTC * max(data.map(el => +el.Volume_BTC)),
      Price_ETH: element.Price_ETH * maxPriceETH,
      Volume_ETH: element.Volume_ETH * max(data.map(el => +el.Volume_ETH)),
      Price_BNB: element.Price_BNB * max(data.map(el => +el.Price_BNB)),
      Volume_BNB: element.Volume_BNB * max(data.map(el => +el.Volume_BNB))

    };
    return output;
  });
  return denormalizedData;
}
//חילוק מערך לקטגוריות
function splitData(data, trainRatio = 0.8, validationRatio = 0.1) {
  // const shuffledData = shuffleArray([...data]);
  const shuffledData = [...data];
  const trainSize = Math.floor(data.length * trainRatio);
  const validationSize = Math.floor(data.length * validationRatio);
  const trainData = shuffledData.slice(0, trainSize);
  const validationData = shuffledData.slice(trainSize, trainSize + validationSize);
  const testData = shuffledData.slice(trainSize + validationSize);
  return { trainData, validationData, testData };
}

// ערבוב מערך
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1)); // מעניין שבלי ";" לא עובד
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

//מעריך ביצועים - חישוב ממוצע של ההפרשים בין הערכים החזויים לערכים האמיתיים. 
function evaluatePerformance(net, testData) {
  let errors = [];
  for (let i = 0; i < testData.length; i++) {
    const input = testData[i].input;
    const actual = testData[i].output;
    const predicted = net.run(input);
    const error = abs(subtract(+predicted.Price_ETH, +actual.Price_ETH));
    errors.push(error);
  }
  const mse = mean(errors);
  return mse;
}