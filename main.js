import * as Math from 'mathjs';
import Papa from 'papaparse';

const data = [];
let maxPrice = 0;
let maxOdometer;
let maxCondition;
let maxYear;
let normalizedData;
let isGeussManufacturerTrained = false;
let geussNet;
let priceNet;
function getUniqueManufacturer(data) {
  const uniqueModels = new Set();
  const result = [];

  data.forEach(element => {
    const key = element.Manufacturer;
    if (element.Manufacturer == "") return;
    if (!uniqueModels.has(key)) {
      uniqueModels.add(key);
      result.push(element.Manufacturer);
    }
  });

  return result;
}
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
async function main() {
  await GetDatafromCSV("./res/car_prices.csv");


  let selectedManufacturer = "Select Manufacturer";
  let selectedYear = "Select Year";

  let uniqueModels = getUniqueManufacturer(data);

  let seletionCars = document.querySelector('#cars');
  let seletionYear = document.querySelector('#years');

  uniqueModels.sort((a, b) => (a > b) ? 1 : -1);

  seletionCars.options[0] = new Option(selectedManufacturer, "");
  for (let i = 0; i < uniqueModels.length; i++) {
    const option = document.createElement("option");
    option.text = uniqueModels[i];
    seletionCars.add(option);
  }

  seletionYear.options[0] = new Option(selectedYear, "");
  for (let i = 1980; i <= 2015; i++) {
    const option = document.createElement("option");
    option.text = i;
    seletionYear.add(option);
  }

  seletionCars.addEventListener('change', (e) => {
    selectedManufacturer = seletionCars.value;
  });

  seletionYear.addEventListener('change', (e) => {
    selectedYear = seletionYear.value;
  });

  let actionBtn = document.querySelector('#actionBtn');


  const tempData = [...data];

  normalizedData = normalizeData(tempData);

  console.log(normalizedData);

  actionBtn.addEventListener('click', () => {
    const selectedCondition = document.querySelector('#inputCondition').value;
    const selectedOdometer = document.querySelector('#inputOdometer').value;
    const model = document.querySelector('#inputModel').value;
    const guess = document.querySelector('#guess');
    if (selectedManufacturer != "Select Manufacturer" && selectedYear != "Select Year" && selectedCondition >= 0 && selectedCondition <= 100 && selectedOdometer >= 0 && selectedCondition != "" && selectedOdometer != "")
      PriceGenerate(selectedManufacturer, selectedYear, selectedCondition, selectedOdometer)
    else {
      let alert = document.querySelector('#alert');
      alert.style.display = "block";
      alert.innerHTML = "Please fill Manufacturer and Year";
      setTimeout(() => {
        alert.style.display = "none";
      }, 3000);
    }


    if (model != "") {
      if (isGeussManufacturerTrained) {
        let res = geussNet.run(model);
        guess.innerHTML = res;
      }
      else {
        ManufacturerModelTrain(model)
        let res = geussNet.run(model);
        guess.innerHTML = res;

      }
    } else {
      let alert = document.querySelector('#alert2');
      alert.style.display = "block";
      alert.innerHTML = "Please fill Model";
      setTimeout(() => {
        alert.style.display = "none";
      }, 3000);
    }
  })

}

async function PriceGenerate(selectedManufacturer, selectedYear, selectedCondition, selectedOdometer) {


  let networkOptions = {
    hiddenLayers: [64, 64]
  };

  priceNet = new brain.recurrent.LSTMTimeStep(networkOptions);


  const { trainData, validationData, testData } = splitData(normalizedData, 0.9, 0.1);

  let tempTrainData = trainData.filter(element => {
    return element.Manufacturer === selectedManufacturer;
  }).map(element => ({
    input: { Year: element.Year, Condition: element.Condition, Odometer: element.Odometer },
    output: { Price: element.Price }
  }));

  console.log(tempTrainData);

  let tempTestData = testData.map(element => ({
    input: {
      Year: element.Year,
      Condition: element.Condition,
      Odometer: element.Odometer,
    }, output: { Price: element.Price }
  }));



  priceNet.train(tempTrainData, {
    errorThresh: 0.025,
    iterations: 50,
    log: true,
    logPeriod: 1,

  });
  try {
    document.querySelector('#priceNet').innerHTML = brain.utilities.toSVG(priceNet);
  } catch (error) {
    console.log(error);
  }

  // let index = 0;
  // index = Math.floor(Math.random(0, tempTrainData.length - 1));

  // let res = net.run(tempTrainData[index].input);


  // console.log("Price = " + tempTrainData[index].output.Price * maxPrice);

  // const pricePerformance = PricePerformance(net, tempTrainData);
  // console.log("Price Diff = " + pricePerformance);


  // if (selectedCondition > maxCondition) maxCondition = selectedCondition;
  // if (selectedOdometer > maxOdometer) maxOdometer = selectedOdometer;
  // if (selectedYear > maxYear) maxYear = selectedYear;

  selectedCondition = +selectedCondition / maxCondition;
  selectedOdometer = +selectedOdometer / maxOdometer;
  selectedYear = +selectedYear / maxYear


  let res = priceNet.run({ Year: selectedYear, Condition: selectedCondition, Odometer: selectedOdometer });
  const recPrice = document.querySelector('#recPrice');
  recPrice.innerHTML = res.Price * maxPrice;

}

async function ManufacturerModelTrain(model) {
  let networkOptions = {
    hiddenLayers: [32]
  };

  geussNet = new brain.recurrent.LSTM(networkOptions);

  let uniqueModels = getUniqueModels(normalizedData);

  uniqueModels.sort((a, b) => (a.Model > b.Model) ? 1 : -1);
  uniqueModels.sort((a, b) => (a.Manufacturer > b.Manufacturer) ? 1 : -1);

  const { trainData, validationData, testData } = splitData(uniqueModels, 0.9, 0.1);

  let tempTrainData = trainData.map(element => ({ input: element.Model, output: element.Manufacturer }));

  geussNet.train(tempTrainData, {
    errorThresh: 0.005,
    iterations: 50,
    log: true,
    logPeriod: 5
  });

  isGeussManufacturerTrained = true;

  try {
    document.querySelector('#geussNet').innerHTML = brain.utilities.toSVG(geussNet);
  } catch (error) {
    console.log(error);
  }

}

main();


//מעריך ביצועים - חישוב ממוצע של ההפרשים בין הערכים החזויים לערכים האמיתיים. 
function PricePerformance(net, testData) {
  let avg = [];
  for (let i = 0; i < testData.length; i++) {
    const input = testData[i].input;
    const actual = testData[i].output.Price;
    const predicted = net.forecast(input);
    const error = Math.abs(Math.subtract(+predicted.Price * maxPrice, +actual * maxPrice));
    avg.push(error);
  }
  const mae = Math.mean(avg);
  return mae;
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
          if (element.condition == "" || element.transmission == "" || element.state != "ca" || element.make == "" || element.model == "" || element.odometer == "") return
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
  maxPrice = Math.max(data.map(el => +el.Price));
  maxOdometer = Math.max(data.map(el => +el.Odometer));
  maxCondition = Math.max(data.map(el => +el.Condition));
  let maxMMR = Math.max(data.map(el => +el.MMR));


  const minYear = Math.min(data.map(el => +el.Year));
  maxYear = Math.max(data.map(el => +el.Year));

  const meanYear = Math.floor(Math.mean(data.map(el => +el.Year)));
  const stdYear = Math.floor(Math.std(data.map(el => +el.Year)));

  const normalizedData = data.map(element => {
    const input = {
      Body: element.Body,
      Condition: +element.Condition / maxCondition * 0.9,
      MMR: element.MMR / maxMMR,
      Manufacturer: element.Manufacturer,
      Model: element.Model,
      Odometer: +element.Odometer / maxOdometer,
      Price: +element.Price / maxPrice,
      Transmission: element.Transmission,
      // Trim: element.Trim, // רמת גימור לא לשימוש

      /*אופציות לנרמול שנת היצור */
      // Year: (element.Year - minYear) / (maxYear - minYear)
      // Year: (element.Year - meanYear) / stdYear
      Year: element.Year / maxYear
    };
    return input;
  });
  return normalizedData;
}

//חילוק מערך לקטגוריות
function splitData(data, trainRatio = 0.8, validationRatio = 0.1) {
  const shuffledData = shuffleArray([...data]);
  // const shuffledData = [...data]; // ביטול ערבוב המערך
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

