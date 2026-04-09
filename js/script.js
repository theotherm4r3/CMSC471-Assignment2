import 'https://esm.sh/d3-transition';

console.log('D3 Version:', d3.version);

//make margins
const margin = {top: 40, right: 40, bottom: 40, left: 60};
const width = 500 - margin.left - margin.right;
const height = 350 - margin.top - margin.bottom;

let allData = [], metaData = []
let xScale, yScale
const t = 1000; // 1000ms = 1 second

let xVar = 'year', yVar = 'secondary_enrollment_gap_gross', sizeVar = 'adolescent_fertility'
let targetCountryCode = "USA", targetCountryName = "United States", targetCountryIncome = "HIC", targetCountryRegion = "NAC"
const options = ['secondary_enrollment_gap_gross', 'secondary_enrollment_gap_net', 'tertiary_enrollment_gap_gross']
const color_options = ['Country', 'Region', 'Income', 'World']
const colorScale = d3.scaleOrdinal(color_options, d3.schemeSet2); // d3.schemeSet2 is a set of predefined colors.
let lowerYear = 1980
let upperYear = 2018
let yMin = -60, yMax = 60;
const yLabels = {
  "secondary_enrollment_gap_gross": "Secondary Enrollment Gap (Gross %)",
  "secondary_enrollment_gap_net": "Secondary Enrollment Gap (Net %)",
  "tertiary_enrollment_gap_gross": "Tertiary Enrollment Gap (Gross %)"
};

const regionMap = {
  "Latin America & Caribbean": "LCN", //including all income levels
  "South Asia": "SAS",
  "Sub-Saharan Africa": "SSF", //including all income levels
  "Europe & Central Asia": "ECS", //including all income levels
  "Middle East & North Africa": "MEA",
  "East Asia & Pacific": "EAS", //including all income levels
  "North America": "NAC"
}

const incomeMap = {
  "High income": "HIC",
  "Low income": "LIC",
  "Lower middle income": "LMC",
  "Upper middle income": "UMC"
}

const regionCodeToName = Object.fromEntries(Object.entries(regionMap).map(([k, v]) => [v, k]));
const incomeCodeToName = Object.fromEntries(Object.entries(incomeMap).map(([k, v]) => [v, k]));

//load data after page is loaded
function init(){
  Promise.all([
    d3.csv("./data/gender.csv", function(d) {
      return {  
        country: d["Country Name"],
        country_code: d["Country Code"],
        year: +d.Year,
        secondary_enrollment_f_net: d["average_value_School enrollment, secondary, female (% net)"] == "" ? NaN : +d["average_value_School enrollment, secondary, female (% net)"],
        secondary_enrollment_m_net: d["average_value_School enrollment, secondary, male (% net)"] == "" ? NaN : +d["average_value_School enrollment, secondary, male (% net)"],
        secondary_enrollment_f_gross: d["average_value_School enrollment, secondary, female (% gross)"] == "" ? NaN : +d["average_value_School enrollment, secondary, female (% gross)"],
        secondary_enrollment_m_gross: d["average_value_School enrollment, secondary, male (% gross)"] == "" ? NaN : +d["average_value_School enrollment, secondary, male (% gross)"],
        tertiary_enrollment_f_gross: d["average_value_School enrollment, tertiary, female (% gross)"] == "" ? NaN : +d["average_value_School enrollment, tertiary, female (% gross)"],
        tertiary_enrollment_m_gross: d["average_value_School enrollment, tertiary, male (% gross)"] == "" ? NaN : +d["average_value_School enrollment, tertiary, male (% gross)"],
        adolescent_fertility: d["average_value_Adolescent fertility rate (births per 1,000 women ages 15-19)"] == "" ? NaN : +d["average_value_Adolescent fertility rate (births per 1,000 women ages 15-19)"]
    }
    }),
    d3.csv("./data/gender_metadata.csv", function(d){
      return{
        country_code: d["Country Code"],
        region: d.Region,
        income_group: d.IncomeGroup
      }
    })
  ])
  .then(([genderData, metadata]) => {
    //console.log("genderData", genderData)
    //console.log("metadata", metadata)

    metaData = metadata

    //need to map to allow selection for join
    const metaByCode = new Map(metadata.map(d => [d.country_code, d]))

    //transforming data
    const transformed_gender = genderData.map(row => ({
      ...row,
      tertiary_enrollment_gap_gross: row.tertiary_enrollment_m_gross - row.tertiary_enrollment_f_gross,
      secondary_enrollment_gap_gross: row.secondary_enrollment_m_gross - row.secondary_enrollment_f_gross,
      secondary_enrollment_gap_net: row.secondary_enrollment_m_net - row.secondary_enrollment_f_net
    }))

    //combining all data and metadata
    const combinedData = transformed_gender.map(row => {
    let currentMetadata = metaByCode.get(row.country_code)
      return {
          ...row,
          region: currentMetadata.region,
          income_group: currentMetadata.income_group
        }
    })

    //convert to long format (1 row per data point, labeled with data type)
    const gapKeys = [
      "tertiary_enrollment_gap_gross",
      "secondary_enrollment_gap_gross",
      "secondary_enrollment_gap_net"
    ];

allData = combinedData.flatMap(row =>
    gapKeys.map(key => {
        //determine which raw columns match the current gap key
        let f_val, m_val;
        if (key === "secondary_enrollment_gap_gross") {
            f_val = row.secondary_enrollment_f_gross;
            m_val = row.secondary_enrollment_m_gross;
        } else if (key === "secondary_enrollment_gap_net") {
            f_val = row.secondary_enrollment_f_net;
            m_val = row.secondary_enrollment_m_net;
        } else if (key === "tertiary_enrollment_gap_gross") {
            f_val = row.tertiary_enrollment_f_gross;
            m_val = row.tertiary_enrollment_m_gross;
        }

        return {
            country: row.country,
            country_code: row.country_code,
            region: row.region,
            income_group: row.income_group,
            year: row.year,
            type: key,
            value: row[key],
            male_val: m_val,
            female_val: f_val,
            adolescent_fertility: row.adolescent_fertility
        };
    })
);

  //  console.log("allData", allData)

   // yMin = d3.min(allData, d => d.value)
    //yMax = d3.max(allData, d => d.value)

    drawBackgrounds()
    updateAxes()
    updateVis()
    addLegend()
    setupSelector()
  })
  .catch(error => console.error("Error loading data:", error))
}

function setupSelector(){
  // Handles UI changes (sliders, dropdowns)
  // Anytime the user tweaks something, this function reacts.
  // May need to call updateAxes() and updateVis() here when needed!

    d3.selectAll('#myMeasurement')
        .selectAll('option')
        .data(options)
        .enter()
        .append('option')
        .text(function (d) {  //returns new label based on option label
            return yLabels[d]
        })
        .attr("value", d => d);

    d3.select('#myCountry')
        .selectAll('option')
        .data(allData.filter(d => d.income_group !== "").sort((a, b) => d3.ascending(a.country, b.country)).map(d => d.country_code).filter((v,i,a) => a.indexOf(v) == i)) //set up countries only for dropdown, alphabetically
        .enter()
        .append('option')
        .text(d => {
            const row = allData.find(row => row.country_code == d);
            return row.country;
        })
        .attr('value', d => d);

    d3.select('#myCountry').property('value', targetCountryCode);

    d3.selectAll('#myMeasurement, #myCountry')
  .on("change", function() {
      const id = d3.select(this).attr("id");
      const value = d3.select(this).property("value");

      if (id === "myMeasurement") {
          yVar = value;
      } else if (id === "myCountry") {
          targetCountryCode = value;
          const row = allData.find(d => d.country_code == value);
          targetCountryName = row.country;
          targetCountryRegion = regionMap[row.region];
          targetCountryIncome = incomeMap[row.income_group];

          console.log("country code: ", targetCountryCode)
          console.log("income: ", targetCountryIncome)
          console.log("region: ", targetCountryRegion)
          
      }

      svg.selectAll('.axis').remove();
      svg.selectAll('.labels').remove();

      svgRegion.selectAll('.axis').remove();
      svgRegion.selectAll('.labels').remove();

      svgIncome.selectAll('.axis').remove();
      svgIncome.selectAll('.labels').remove();

      svgWorld.selectAll('.axis').remove();
      svgWorld.selectAll('.labels').remove();

      updateAxes();
      updateVis();
  });
  }

function updateAxes(){
  // Draws the x-axis and y-axis
  // Adds ticks, labels, and makes sure everything lines up nicely

  // Create x scale
xScale = d3.scaleLinear()
    .domain([lowerYear, upperYear])
    .range([0, width]);
const xAxis = d3.axisBottom(xScale)
    .tickFormat(d3.format("d"))

svg.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${height})`) // Position at the bottom
    .call(xAxis);

svgRegion.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${height})`) // Position at the bottom
    .call(xAxis);

  svgIncome.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${height})`) // Position at the bottom
    .call(xAxis);

    svgWorld.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${height})`) // Position at the bottom
    .call(xAxis);

//create y scale
yScale = d3.scaleLinear()
  .domain([yMin, yMax])
  .range([height, 0]);
const yAxis = d3.axisLeft(yScale)

svg.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,0)`) // Position at the bottom
    .call(yAxis);

svgRegion.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,0)`) // Position at the bottom
    .call(yAxis);

  svgIncome.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,0)`) // Position at the bottom
    .call(yAxis);

    svgWorld.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,0)`) // Position at the bottom
    .call(yAxis);

// X-axis label
svg.append("text")
    .attr("x", width / 2)
    .attr("y", height + margin.bottom)
    .attr("text-anchor", "middle")
    .text("Year") // Displays the current x-axis variable
    .attr('class', 'labels')

    // X-axis label
svgRegion.append("text")
    .attr("x", width / 2)
    .attr("y", height + margin.bottom)
    .attr("text-anchor", "middle")
    .text("Year") // Displays the current x-axis variable
    .attr('class', 'labels')

      // X-axis label
svgIncome.append("text")
    .attr("x", width / 2)
    .attr("y", height + margin.bottom)
    .attr("text-anchor", "middle")
    .text("Year") // Displays the current x-axis variable
    .attr('class', 'labels')

      // X-axis label
svgWorld.append("text")
    .attr("x", width / 2)
    .attr("y", height + margin.bottom)
    .attr("text-anchor", "middle")
    .text("Year") // Displays the current x-axis variable
    .attr('class', 'labels')


// Y-axis label (rotated)
svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -margin.left + 15)
    .attr("text-anchor", "middle")
    .text(yLabels[yVar]) // Displays the current y-axis variable
    .attr('class', 'labels')

  // Y-axis label (rotated)
svgRegion.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -margin.left + 15)
    .attr("text-anchor", "middle")
    .text(yLabels[yVar]) // Displays the current y-axis variable
    .attr('class', 'labels')

    // Y-axis label (rotated)
svgIncome.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -margin.left + 15)
    .attr("text-anchor", "middle")
    .text(yLabels[yVar]) // Displays the current y-axis variable
    .attr('class', 'labels')

    // Y-axis label (rotated)
svgWorld.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -margin.left + 15)
    .attr("text-anchor", "middle")
    .text(yLabels[yVar]) // Displays the current y-axis variable
    .attr('class', 'labels')

      // Title
svg.append("text")
    .attr("x", 0)
    .attr("y", -10)
    .attr("text-anchor", "start")
    .text(targetCountryName.toUpperCase()) // Displays the current x-axis variable
    .attr('class', 'labels')
        .style('font-weight', 'bold')


      // Title
svgRegion.append("text")
    .attr("x", 0)
    .attr("y", -10)
    .attr("text-anchor", "start")
    .text(`REGION: ${regionCodeToName[targetCountryRegion].toUpperCase()}`) // Displays the current x-axis variable
    .attr('class', 'labels')
        .style('font-weight', 'bold')


      // Title
svgIncome.append("text")
    .attr("x", 0)
    .attr("y", -10)
    .attr("text-anchor", "start")
    .text(`INCOME: ${incomeCodeToName[targetCountryIncome].toUpperCase()}`)
    .attr('class', 'labels')
    .style('font-weight', 'bold')


      //Title
svgWorld.append("text")
    .attr("x", 0)
    .attr("y", -10)
    .attr("text-anchor", "start")
    .text("WORLD AVERAGE") // Displays the current x-axis variable
    .attr('class', 'labels')
    .style('font-weight', 'bold')

 
}

function updateVis(){

const line = d3.line()
        .x(d => xScale(d.year))
        .y(d => yScale(d.value))
        .defined(d => !isNaN(d.value));

let filteredData = allData.filter(d => d.year >= lowerYear && d.year <= upperYear);

// Country line
const countryData = filteredData
    .filter(d => d.country_code == targetCountryCode && d.type == yVar)
    .sort((a,b) => a.year - b.year);

console.log("country data:", countryData)

svg.selectAll(".country-line")
    .data([countryData])
    .join(
        enter => enter.append("path")
                      .attr("class", "country-line")
                      .attr("fill", "none")
                      .attr("stroke", colorScale("Country"))
                      .attr("stroke-width", 2)
                      .attr("d", line), 
        update => update.transition(t)
                        .attr("d", line), 
        exit => exit.remove() 
    );

  // Region line
const regionData = filteredData
    .filter(d => d.country_code == targetCountryRegion && d.type == yVar)
    .sort((a,b) => a.year - b.year);

console.log("region data:", regionData)

svgRegion.selectAll(".region-line")
    .data([regionData])
    .join(
        enter => enter.append("path")
                      .attr("class", "region-line")
                      .attr("fill", "none")
                      .attr("stroke", colorScale("Region"))
                      .attr("stroke-width", 2)
                      .attr("d", line),
        update => update.transition(t)
                        .attr("d", line), 
        exit => exit.remove() 
    );


  // Income line
const incomeData = filteredData
    .filter(d => d.country_code == targetCountryIncome && d.type == yVar)
    .sort((a,b) => a.year - b.year);

console.log("income data:", incomeData)

svgIncome.selectAll(".income-line")
    .data([incomeData])
    .join(
        enter => enter.append("path")
                      .attr("class", "income-line")
                      .attr("fill", "none")
                      .attr("stroke", colorScale("Income"))
                      .attr("stroke-width", 2)
                      .attr("d", line),
        update => update.transition(t)
                        .attr("d", line),
        exit => exit.remove()
    );

    // Income line
const worldData = filteredData
    .filter(d => d.country_code == "WLD" && d.type == yVar)
    .sort((a,b) => a.year - b.year);

console.log("world data:", worldData)

svgWorld.selectAll(".world-line")
    .data([worldData])
    .join(
        enter => enter.append("path")
                      .attr("class", "world-line")
                      .attr("fill", "none")
                      .attr("stroke", colorScale("World"))
                      .attr("stroke-width", 2)
                      .attr("d", line),
        update => update.transition(t)
                        .attr("d", line), 
        exit => exit.remove()
    );

//const currentData = linesData.find(d => d.name === "Country").data;
const filteredDots = countryData.filter(d => !isNaN(d.value));

svg.selectAll('.points')
    // Why use d => d.country as the key?
    // Because each country is unique in the dataset for the current year. 
    // This helps D3 know which bubbles to keep, update, or remove.
    .data(filteredDots, d => d.country + '-' + d.year + '-' + d.type)
    .join(
        function(enter){
             // New data points go here
            return enter
            .append('circle')
            .attr('class', 'points')
            .attr('cx', d => xScale(d.year)) // Position on x-axis
            .attr('cy', d => yScale(d.value)) // Position on y-axis
            .style('fill', colorScale("Country"))
            .style('opacity', 1) 
            .attr('r', 0) // before transition r = 0
            .on('mouseover', function (event, d) {
                console.log(d) 
                d3.select('#tooltip')
                    .style("display", 'block') 
                    .html( 
                    `<strong>${d.country}</strong><br/>
                    Year: ${d.year}<br/>
                    Male Enrollment: ${d.male_val.toFixed(1)}<br/>
                    Female Enrollment: ${d.female_val.toFixed(1)}<br/>
                    Gender Gap: ${d.value.toFixed(1)}`)
                    .style("left", (event.pageX + 20) + "px")
                    .style("top", (event.pageY - 28) + "px");
                d3.select(this)
                .style('stroke', 'black')
                .style('stroke-width', '1px')
            })
            .on("mouseout", function (event, d) {
                d3.select('#tooltip')
                .style('display', 'none') 
                 d3.select(this)
                .style('stroke', 'black')
                .style('stroke-width', '0px')
                 .style('opacity', 1)
            })
            .transition(t)
            .attr('r', 2)
        },
        function(update){
             // Existing points get updated here
            return update
            .transition(t)
            .attr('cx', d => xScale(d.year))
            .attr('cy', d => yScale(d.value))
        },
        function(exit){
             // Old points get removed here
            exit
            .transition(t)
            .attr('r', 0)  // Shrink to radius 0
            .remove()
        }
    )

//const currentData = linesData.find(d => d.name === "Country").data;
const filteredDotsRegion = regionData.filter(d => !isNaN(d.value));

svgRegion.selectAll('.points')
    // Why use d => d.country as the key?
    // Because each country is unique in the dataset for the current year. 
    // This helps D3 know which bubbles to keep, update, or remove.
    .data(filteredDotsRegion, d => d.country + '-' + d.year + '-' + d.type)
    .join(
        function(enter){
             // New data points go here
            return enter
            .append('circle')
            .attr('class', 'points')
            .attr('cx', d => xScale(d.year)) 
            .attr('cy', d => yScale(d.value)) 
            .style('fill', colorScale("Region"))
            .style('opacity', 1) 
            .attr('r', 0) 
            .on('mouseover', function (event, d) {
                console.log(d) 
                d3.select('#tooltip')
                    .style("display", 'block') 
                    .html( 
                    `<strong> Region: ${d.country}</strong><br/>
                    Year: ${d.year}<br/>
                    Male Enrollment: ${d.male_val.toFixed(1)}<br/>
                    Female Enrollment: ${d.female_val.toFixed(1)}<br/>
                    Gender Gap: ${d.value.toFixed(1)}`)
                    .style("left", (event.pageX + 20) + "px")
                    .style("top", (event.pageY - 28) + "px");
                d3.select(this) 
                .style('stroke', 'black')
                .style('stroke-width', '1px')
            })
            .on("mouseout", function (event, d) {
                d3.select('#tooltip')
                .style('display', 'none') 
                 d3.select(this) 
                .style('stroke', 'black')
                .style('stroke-width', '0px')
                 .style('opacity', 1)
            })
            .transition(t)
            .attr('r', 2)
        },
        function(update){
             // Existing points get updated here
            return update
            .transition(t)
            .attr('cx', d => xScale(d.year))
            .attr('cy', d => yScale(d.value))
        },
        function(exit){
             // Old points get removed here
            exit
            .transition(t)
            .attr('r', 0)  // Shrink to radius 0
            .remove()
        }
    )


    //const currentData = linesData.find(d => d.name === "Country").data;
const filteredDotsIncome = incomeData.filter(d => !isNaN(d.value));

svgIncome.selectAll('.points')
    // Why use d => d.country as the key?
    // Because each country is unique in the dataset for the current year. 
    // This helps D3 know which bubbles to keep, update, or remove.
    .data(filteredDotsIncome, d => d.country + '-' + d.year + '-' + d.type)
    .join(
        function(enter){
             // New data points go here
            return enter
            .append('circle')
            .attr('class', 'points')
            .attr('cx', d => xScale(d.year)) // Position on x-axis
            .attr('cy', d => yScale(d.value)) // Position on y-axis
            .style('fill', colorScale("Income"))
            .style('opacity', 1) 
            .attr('r', 0) 
            .on('mouseover', function (event, d) {
                console.log(d) 
                d3.select('#tooltip')
                    .style("display", 'block')
                    .html(
                    `<strong> Income: ${d.country}</strong><br/>
                    Year: ${d.year}<br/>
                    Male Enrollment: ${d.male_val.toFixed(1)}<br/>
                    Female Enrollment: ${d.female_val.toFixed(1)}<br/>
                    Gender Gap: ${d.value.toFixed(1)}`)
                    .style("left", (event.pageX + 20) + "px")
                    .style("top", (event.pageY - 28) + "px");
                d3.select(this)
                .style('stroke', 'black')
                .style('stroke-width', '1px')
            })
            .on("mouseout", function (event, d) {
                d3.select('#tooltip')
                .style('display', 'none') 
                 d3.select(this) 
                .style('stroke', 'black')
                .style('stroke-width', '0px')
                 .style('opacity', 1)
            })
            .transition(t)
            .attr('r', 2)
        },
        function(update){
             // Existing points get updated here
            return update
            .transition(t)
            .attr('cx', d => xScale(d.year))
            .attr('cy', d => yScale(d.value))
        },
        function(exit){
             // Old points get removed here
            exit
            .transition(t)
            .attr('r', 0)  // Shrink to radius 0
            .remove()
        }
    )

        //const currentData = linesData.find(d => d.name === "Country").data;
const filteredDotsWorld = worldData.filter(d => !isNaN(d.value));

svgWorld.selectAll('.points')
    // Why use d => d.country as the key?
    // Because each country is unique in the dataset for the current year. 
    // This helps D3 know which bubbles to keep, update, or remove.
    .data(filteredDotsWorld, d => d.country + '-' + d.year + '-' + d.type)
    .join(
        function(enter){
             // New data points go here
            return enter
            .append('circle')
            .attr('class', 'points')
            .attr('cx', d => xScale(d.year))
            .attr('cy', d => yScale(d.value)) 
            .style('fill', colorScale("World"))
            .style('opacity', 1) 
            .attr('r', 0) 
            .on('mouseover', function (event, d) {
                console.log(d) 
                d3.select('#tooltip')
                    .style("display", 'block') 
                    .html( 
                    `<strong> World Average</strong><br/>
                    Year: ${d.year}<br/>
                    Male Enrollment: ${d.male_val.toFixed(1)}<br/>
                    Female Enrollment: ${d.female_val.toFixed(1)}<br/>
                    Gender Gap: ${d.value.toFixed(1)}`)
                    .style("left", (event.pageX + 20) + "px")
                    .style("top", (event.pageY - 28) + "px");
                d3.select(this)
                .style('stroke', 'black')
                .style('stroke-width', '1px')
            })
            .on("mouseout", function (event, d) {
                d3.select('#tooltip')
                .style('display', 'none')
                 d3.select(this) 
                .style('stroke', 'black')
                .style('stroke-width', '0px')
                 .style('opacity', 1)
            })
            .transition(t)
            .attr('r', 2)
        },
        function(update){
             // Existing points get updated here
            return update
            .transition(t)
            .attr('cx', d => xScale(d.year))
            .attr('cy', d => yScale(d.value))
        },
        function(exit){
             // Old points get removed here
            exit
            .transition(t)
            .attr('r', 0)  // Shrink to radius 0
            .remove()
        }
    )


}

function addLegend(){
 // Adds a legend so users can decode colors
    // let size = 10  // Size of the legend squares
    // svg.selectAll('continentSquare')
    // .data(continents)
    // .enter()
    // .append("rect")
    // .attr("x", (d,i) => i * (size + 100) + 100)
    // .attr("y", -margin.top/2) 
    // .attr("width", size)
    // .attr("height", size)
    // .style("fill", d => colorScale(d))

    //   svg.selectAll("continentName")
    //     .data(continents)
    //     .enter()
    //     .append("text")
    //     .attr("y", -margin.top/2 + size) // Align vertically with the square
    //     .attr("x", (d, i) => i * (size + 100) + 120)  
    //     .style("fill", d => colorScale(d))  // Match text color to the square
    //     .text(d => d) // The actual continent name
    //     .attr("text-anchor", "left")
    //     .style('font-size', '13px')

}

window.addEventListener('load', init);

// Create SVG
const svg = d3.select('#whitehat-vis')
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

    // Create SVG
const svgRegion = d3.select('#whitehat-vis-region')
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

      // Create SVG
const svgIncome = d3.select('#whitehat-vis-income')
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

        // Create SVG
const svgWorld = d3.select('#whitehat-vis-world')
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);



    

function drawBackgrounds(){
    //initialize backgrounds
    // Top half blue
svg.append('rect')
    .attr('class', 'bg-half')
    .attr('x', 0)
    .attr('y', 0)  // top
    .attr('width', width)
    .attr('height', height / 2) // half the height
    .style('fill', 'lightblue')
    .style('opacity', 0.3)
    .style('pointer-events', 'none');

// Bottom half red
svg.append('rect')
    .attr('class', 'bg-half')
    .attr('x', 0)
    .attr('y', (height) / 2)  // start at middle
    .attr('width', width)
    .attr('height', height / 2)
    .style('fill', 'lightcoral')
    .style('opacity', 0.3)
    .style('pointer-events', 'none');

  // Top half blue
svgRegion.append('rect')
    .attr('class', 'bg-half')
    .attr('x', 0)
    .attr('y', 0)  // top
    .attr('width', width)
    .attr('height', height / 2) // half the height
    .style('fill', 'lightblue')
    .style('opacity', 0.3)
    .style('pointer-events', 'none');

// Bottom half red
svgRegion.append('rect')
    .attr('class', 'bg-half')
    .attr('x', 0)
    .attr('y', (height) / 2)  // start at middle
    .attr('width', width)
    .attr('height', height / 2)
    .style('fill', 'lightcoral')
    .style('opacity', 0.3)
    .style('pointer-events', 'none');

    // Top half blue
svgIncome.append('rect')
    .attr('class', 'bg-half')
    .attr('x', 0)
    .attr('y', 0)  // top
    .attr('width', width)
    .attr('height', height / 2) // half the height
    .style('fill', 'lightblue')
    .style('opacity', 0.3)
    .style('pointer-events', 'none');

// Bottom half red
svgIncome.append('rect')
    .attr('class', 'bg-half')
    .attr('x', 0)
    .attr('y', (height) / 2)  // start at middle
    .attr('width', width)
    .attr('height', height / 2)
    .style('fill', 'lightcoral')
    .style('opacity', 0.3)
    .style('pointer-events', 'none');

    // Top half blue
svgWorld.append('rect')
    .attr('class', 'bg-half')
    .attr('x', 0)
    .attr('y', 0)  // top
    .attr('width', width)
    .attr('height', height / 2) // half the height
    .style('fill', 'lightblue')
    .style('opacity', 0.3)
    .style('pointer-events', 'none');

// Bottom half red
svgWorld.append('rect')
    .attr('class', 'bg-half')
    .attr('x', 0)
    .attr('y', (height) / 2)  // start at middle
    .attr('width', width)
    .attr('height', height / 2)
    .style('fill', 'lightcoral')
    .style('opacity', 0.3)
    .style('pointer-events', 'none');


svg.append('text')
    .attr('class', 'annotation top-right')
    .attr('x', width - 10)
    .attr('y', 10)  
    .attr('text-anchor', 'end') 
    .attr('dominant-baseline', 'hanging')
    .style('font-size', '12px')
    .style('font-weight', 'bold')
    .text('More Males Than Females')
    .style('pointer-events', 'none');

svg.append('text')
    .attr('class', 'annotation bottom-right')
    .attr('x', width - 10) 
    .attr('y', height - 10)  
    .attr('text-anchor', 'end') 
    .attr('dominant-baseline', 'auto')
    .style('font-size', '12px')
    .style('font-weight', 'bold')
    .text('More Females Than Males')
    .style('pointer-events', 'none');

  svgRegion.append('text')
    .attr('class', 'annotation top-right')
    .attr('x', width - 10)
    .attr('y', 10)  
    .attr('text-anchor', 'end') 
    .attr('dominant-baseline', 'hanging')
    .style('font-size', '12px')
    .style('font-weight', 'bold')
        .text('More Males Than Females')
    .style('pointer-events', 'none');


svgRegion.append('text')
    .attr('class', 'annotation bottom-right')
    .attr('x', width - 10) 
    .attr('y', height - 10)  
    .attr('text-anchor', 'end') 
    .attr('dominant-baseline', 'auto')
    .style('font-size', '12px')
    .style('font-weight', 'bold')
        .text('More Females Than Males')
    .style('pointer-events', 'none');

  svgIncome.append('text')
    .attr('class', 'annotation top-right')
    .attr('x', width - 10)
    .attr('y', 10)  
    .attr('text-anchor', 'end') 
    .attr('dominant-baseline', 'hanging')
    .style('font-size', '12px')
    .style('font-weight', 'bold')
        .text('More Males Than Females')
    .style('pointer-events', 'none');


svgIncome.append('text')
    .attr('class', 'annotation bottom-right')
    .attr('x', width - 10) 
    .attr('y', height - 10)  
    .attr('text-anchor', 'end') 
    .attr('dominant-baseline', 'auto')
    .style('font-size', '12px')
    .style('font-weight', 'bold')
        .text('More Females Than Males')
    .style('pointer-events', 'none');

svgWorld.append('text')
    .attr('class', 'annotation top-right')
    .attr('x', width - 10)
    .attr('y', 10)  
    .attr('text-anchor', 'end') 
    .attr('dominant-baseline', 'hanging')
    .style('font-size', '12px')
    .style('font-weight', 'bold')
        .text('More Males Than Females')
    .style('pointer-events', 'none');

svgWorld.append('text')
    .attr('class', 'annotation bottom-right')
    .attr('x', width - 10) 
    .attr('y', height - 10)  
    .attr('text-anchor', 'end') 
    .attr('dominant-baseline', 'auto')
    .style('font-size', '12px')
    .style('font-weight', 'bold')
        .text('More Females Than Males')
    .style('pointer-events', 'none');

}
