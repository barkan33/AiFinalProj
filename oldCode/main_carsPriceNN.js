import { abs, floor, log, max, mean, min, random, round, std, subtract } from 'mathjs';
import Papa from 'papaparse';

const data = [];
let maxPrice = 0;
let maxMMR = 0;
let maxOdometer = 0;
let maxCondition = 0;
async function main() {
  await GetDatafromCSV("./res/car_prices.csv");


  const tempData = [];
  data.map(element => {
    if (element.transmission == "") return
    if (element.Manufacturer == "BMW" && element.Model == "M5")
      tempData.push(element);

  });

  let normalizedData = normalizeData(tempData);
  console.log(normalizedData.length);

  let networkOptions = {
    // hiddenLayers: [512, 256]
    hiddenLayers: [64, 64]
  };


  // create network options
  const net = new brain.NeuralNetwork(networkOptions);


  const { trainData, validationData, testData } = splitData(normalizedData, 0.9, 0.1);

  let tempTrainData = trainData.map(element => ({ input: { Year: element.Year, Condition: element.Condition, Odometer: element.Odometer }, output: { Price: element.Price } }));
  let tempTestData = testData.map(element => ({ input: { Year: element.Year, Condition: element.Condition, Odometer: element.Odometer }, output: { Price: element.Price } }));

  console.log(tempTrainData);
  net.train(tempTrainData, {
    errorThresh: 0.025,
    iterations: 1000,
    log: true,
    logPeriod: 100
  });

  // document.querySelector('#netPrice').innerHTML = brain.utilities.toSVG(net);
  let index = 66;
  // index = floor(random(0, tempTrainData.length - 1));

  let res = net.run(tempTrainData[index].input);
  console.log("result = " + res.Price * maxPrice);
  console.log("Price = " + tempData[index].Price);
  console.log("MMR = " + tempData[index].MMR);
  const pricePerformance = PricePerformance(net, tempTrainData);
  console.log("Price Diff = " + pricePerformance);


}


main();


function PricePerformance(net, testData) {
  let avg = [];
  for (let i = 0; i < testData.length; i++) {
    const input = testData[i].input;
    const actual = testData[i].output;
    const predicted = net.run(input);
    const error = abs(subtract(+predicted.Price * maxPrice, +actual.Price * maxPrice));
    // console.log(error);
    avg.push(error);
  }
  const mse = mean(avg);
  return mse;
}
function titleCase(str) {
  str = str.toLowerCase().split(' ');
  for (var i = 0; i < str.length; i++) {
    str[i] = str[i].charAt(0).toUpperCase() + str[i].slice(1);
  }
  return str.join(' ');
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
          if (element.condition == "" || element.transmission == "" || element.state != "ca") return
          data.push({
            Year: +element.year,
            Manufacturer: titleCase(element.make),
            Model: element.model,
            Trim: element.trim,
            Body: element.body,
            Transmission: element.transmission,
            Condition: +element.condition,
            Odometer: +element.odometer,
            MMR: +element.mmr,
            Price: +element.sellingprice,
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
  maxPrice = max(data.map(el => +el.Price));
  maxOdometer = max(data.map(el => +el.Odometer));
  maxCondition = max(data.map(el => +el.Condition));
  maxMMR = max(data.map(el => +el.MMR));


  const minYear = min(data.map(el => +el.Year));
  const maxYear = max(data.map(el => +el.Year));



  const normalizedData = data.map(element => {
    const input = {
      Body: element.Body,
      Condition: +element.Condition / maxCondition,
      MMR: element.MMR / maxMMR,
      Manufacturer: element.Manufacturer,
      Model: element.Model,
      Odometer: +element.Odometer / maxOdometer,
      Price: +element.Price / maxPrice,
      Transmission: element.Transmission,
      Year: (element.Year - minYear) / (maxYear - minYear)
    };
    return input;
  });
  return normalizedData;
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
