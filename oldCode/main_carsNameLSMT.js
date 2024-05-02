import { abs, log, max, mean, min, std, subtract } from 'mathjs';
import Papa from 'papaparse';

const data = [];

async function main() {
  await GetDatafromCSV("./res/car_prices.csv");


  const tempData = [];
  data.map(element => {
    if (element.transmission == "") return
    if (element.Year == "2015")
      tempData.push(element);

  });

  let normalizedData = normalizeData(tempData);
  console.log(normalizedData.length);

  let networkOptions = {
    hiddenLayers: [32]
  };


  // create network options
  const net = new brain.recurrent.LSTM(networkOptions);

  let uniqueModels = getUniqueModels(normalizedData);


  uniqueModels.sort((a, b) => (a.Model > b.Model) ? 1 : -1);
  uniqueModels.sort((a, b) => (a.Manufacturer > b.Manufacturer) ? 1 : -1);
  const { trainData, validationData, testData } = splitData(uniqueModels, 0.5, 0.1);

  let tempTrainData = trainData.map(element => ({ input: element.Model, output: element.Manufacturer }));

  console.log(tempTrainData);
  // let tempTestData = uniqueModels.map(element => ({ input: element.Manufacturer, output: element.Model }));


  net.train(tempTrainData, {
    errorThresh: 0.005,
    iterations: 1500,
    log: true,
    logPeriod: 150
  });

  // document.querySelector('#netPrice').innerHTML = brain.utilities.toSVG(net);
  console.log(tempTrainData[0]);
  let res = net.run("Verano");
  console.log(res);

  // console.log("Price = " + tempTrainData[0].output * maxPrice);
  // const pricePerformance = PricePerformance(net, tempTrainData);

  // console.log("Price Diff = " + pricePerformance);



  // const mse = evaluatePerformance(net, tempTestData) * 100;
  // console.log("NotReallyMSE = " + mse + "%");

}



main();

function getUniqueModels(data) {
  const uniqueModels = new Set();
  const result = [];

  data.forEach(element => {
    const key = `${element.Manufacturer}-${element.Model}`;
    if (element.Manufacturer == "" || element.Model == "") return;
    if (!uniqueModels.has(key)) {
      uniqueModels.add(key);
      result.push({
        Model: element.Model,
        Manufacturer: element.Manufacturer
      });
    }
  });

  return result;
}

function PricePerformance(net, testData) {
  let avg = [];
  for (let i = 0; i < testData.length; i++) {
    const input = testData[i].input;
    const actual = testData[i].output;
    const predicted = net.forecast(input);
    const error = abs(subtract(+predicted[0] * maxPrice, +actual[0] * maxPrice));
    avg.push(error);
  }
  const mse = mean(avg);
  return mse;
}


function titleCase(str) {
  str = str.toLowerCase().split(' ');
  for (let i = 0; i < str.length; i++) {
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

  const normalizedData = data.map(element => {
    const input = {
      Manufacturer: element.Manufacturer,
      Model: element.Model,
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