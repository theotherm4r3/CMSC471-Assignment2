import 'https://esm.sh/d3-transition';

console.log('D3 Version:', d3.version);

//make margins
const margin = {top: 25, right: 30, bottom: 35, left: 60};
const width = 500 - margin.left - margin.right;
const height = 300 - margin.top - margin.bottom;

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
        if (key == "secondary_enrollment_gap_gross") {
            f_val = row.secondary_enrollment_f_gross;
            m_val = row.secondary_enrollment_m_gross;
        } else if (key == "secondary_enrollment_gap_net") {
            f_val = row.secondary_enrollment_f_net;
            m_val = row.secondary_enrollment_m_net;
        } else if (key == "tertiary_enrollment_gap_gross") {
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
          d3.select("#gross-warning")
            .style("display", yVar.includes("_net") ? "none" : "block"); //hide warning about gross if gross is selected
          d3.select("#gross-meaning")
            .style("display", yVar.includes("_net") ? "none" : "block");
          d3.select("#net-meaning")
            .style("display", yVar.includes("_net") ? "block" : "none");
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
    .text(`COUNTRY: ${targetCountryName.toUpperCase()}`) // Displays the current x-axis variable
    .attr('class', 'labels')
    .style('font-weight', 'bold')
    .on('mouseover', function (event, d) {
                console.log(d) 
                d3.select('#tooltip')
                    .style("display", 'block') 
                    .html( 
                    `<p><b>Country: ${targetCountryName.toUpperCase()}</b></br>
                    <p><b>Region:  ${targetCountryRegion.toUpperCase()}</p></b></br>
                    <p><b>Income Level: ${targetCountryIncome.toUpperCase()}`)
                    .style("left", (event.pageX + 20) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function (event, d) {
                d3.select('#tooltip')
                .style('display', 'none') 
                 d3.select(this)
                .style('stroke', 'black')
                .style('stroke-width', '0px')
                 .style('opacity', 1)
            })



      // Title
svgRegion.append("text")
    .attr("x", 0)
    .attr("y", -10)
    .attr("text-anchor", "start")
    .text(`REGION: ${regionCodeToName[targetCountryRegion].toUpperCase()}`) // Displays the current x-axis variable
    .attr('class', 'labels')
    .style('font-weight', 'bold')
     .on('mouseover', function (event, d) {
                console.log(d) 
                d3.select('#tooltip')
                    .style("display", 'block') 
                    .html( 
                    `<p><b>Region: </b><i>Aggregate gender gap for all countries in this region. Includes all income levels. </i></p>`)
                    .style("left", (event.pageX + 20) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function (event, d) {
                d3.select('#tooltip')
                .style('display', 'none') 
                 d3.select(this)
                .style('stroke', 'black')
                .style('stroke-width', '0px')
                 .style('opacity', 1)
            })


      // Title
svgIncome.append("text")
    .attr("x", 0)
    .attr("y", -10)
    .attr("text-anchor", "start")
    .text(`INCOME: ${incomeCodeToName[targetCountryIncome].toUpperCase()}`)
    .attr('class', 'labels')
    .style('font-weight', 'bold')
    .on('mouseover', function (event, d) {
                console.log(d) 
                d3.select('#tooltip')
                    .style("display", 'block') 
                    .html( 
                    `<p><b>Income Level: </b><i>Aggregate gender gap for all countries with this income level. Based on GNI per capita. </i></p>`)
                    .style("left", (event.pageX + 20) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function (event, d) {
                d3.select('#tooltip')
                .style('display', 'none') 
                 d3.select(this)
                .style('stroke', 'black')
                .style('stroke-width', '0px')
                 .style('opacity', 1)
            })



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

//BLACK HAT VISUALIZATION 

function drawBlackHat() {

  d3.csv("./data/gender.csv", function(d) {
    return {
      country:      d["Country Name"],
      country_code: d["Country Code"],
      year:         +d.Year,
      tertiary_f:   d["average_value_School enrollment, tertiary, female (% gross)"] === ""
                      ? NaN
                      : +d["average_value_School enrollment, tertiary, female (% gross)"],
      tertiary_m:   d["average_value_School enrollment, tertiary, male (% gross)"] === ""
                      ? NaN
                      : +d["average_value_School enrollment, tertiary, male (% gross)"]
    };
  }).then(function(raw) {

    //compute gap for every row in range
    const inRange = raw
      .filter(d =>
        d.year >= 1995 &&
        d.year <= 2018 &&
        !isNaN(d.tertiary_f) &&
        !isNaN(d.tertiary_m)
      )
      .map(d => ({ ...d, gap: d.tertiary_m - d.tertiary_f }));

    //per-country stats
    const byCountry = d3.group(inRange, d => d.country_code);

    const stats = [];
    byCountry.forEach((rows, code) => {
      const aggregateCodes = new Set([
        'WLD','HIC','LIC','LMC','UMC','LMY','MIC','OED',
        'NAC','ECS','EAS','SAS','MEA','SSF','LCN','AFE','AFW',
        'IBD','IDX','IDA','FCS','HPC','PRE','PST','TSA','TSS',
        'EAP','ECA','LAC','MNA','SAS','SSA','ARB','CSS','CEB',
        'EAR','EMU','EUU','FRO','GIB','HKG','IMN','MAC','MNP',
        'NCL','PSE','PYF','TWN','VIR','XKX','INX'
      ]);
      if (code.length !== 3 || aggregateCodes.has(code)) return;

      const yearCount  = rows.length;
      const posCount   = rows.filter(r => r.gap > 0).length;
      const posFraction = posCount / yearCount;
      const avgGap     = d3.mean(rows, r => r.gap);
      const minGap     = d3.min(rows, r => r.gap);

      stats.push({ code, country: rows[0].country, yearCount, posFraction, avgGap, minGap });
    });

    //pick 6 countries that satisfy conditions
    const candidates = stats
      .filter(s =>
        s.yearCount >= 15 &&
        s.posFraction === 1.0 &&   // never dips below zero
        s.avgGap >= 1 &&
        s.avgGap <= 15
      )
      .sort((a, b) => b.yearCount - a.yearCount);  // prefer most complete

    console.log('[BH] candidate countries:', candidates.slice(0, 12).map(s =>
      `${s.code} (${s.country}): ${s.yearCount} yrs, avg gap ${s.avgGap.toFixed(1)}, min ${s.minGap.toFixed(1)}`
    ));

    //Pick first 6; if fewer than 6 pass the strict filter
    let chosen = candidates.slice(2, 7);
    if (chosen.length < 5) {
      const fallback = stats
        .filter(s => s.yearCount >= 12 && s.posFraction >= 0.85 && s.avgGap >= 1 && s.avgGap <= 15)
        .sort((a, b) => b.yearCount - a.yearCount);
      chosen = fallback.slice(0, 5);
    }

    console.log('[BH] chosen:', chosen.map(s => `${s.code} (${s.country})`));

    const featuredCodes = chosen.map(s => s.code);
    const featuredNames = Object.fromEntries(chosen.map(s => [s.code, s.country]));

    //final dataset using chosen countries
    const bhData = inRange
      .filter(d => featuredCodes.includes(d.country_code) && d.gap >= 0)
      .sort((a, b) => a.year - b.year);

    console.log('[BH] final rows:', bhData.length);

    if (bhData.length === 0) {
      d3.select('#blackhat-vis')
        .append('p').style('color','red').style('text-align','center')
        .text('No data found — check console.');
      return;
    }

    //Layout
    const bMargin = { top: 150, right: 200, bottom: 150, left: 180 };
    const totalW  = 960;
    const totalH  = 540;
    const bWidth  = totalW - bMargin.left - bMargin.right;
    const bHeight = totalH - bMargin.top  - bMargin.bottom;

    d3.select('#blackhat-vis')
      .style('width', '100%')
      .style('display', 'flex')
      .style('justify-content', 'center');

    const svgBH = d3.select('#blackhat-vis')
      .append('svg')
      .attr('width',  totalW)
      .attr('height', totalH)
      .style('display', 'block')
      .style('max-width', '100%')
      .append('g')
      .attr('transform', `translate(${bMargin.left},${bMargin.top})`);

    //zoomed y-axis
    const bhYMin = -2;
    const bhYMax = Math.ceil(d3.max(bhData, d => d.gap)) + 1;

    const bhXScale = d3.scaleLinear().domain([1995, 2018]).range([0, bWidth]);
    const bhYScale = d3.scaleLinear().domain([bhYMin, bhYMax]).range([bHeight, 0]);
    const bhColor  = d3.scaleOrdinal(featuredCodes, d3.schemeTableau10);

    //Parity zone shading
    svgBH.append('rect')
      .attr('x', 0).attr('y', bhYScale(1))
      .attr('width', bWidth)
      .attr('height', bhYScale(-2) - bhYScale(1))
      .attr('fill', '#c8e6c9').attr('opacity', 0.5);

    svgBH.append('text')
      .attr('x', 600).attr('y', bhYScale(1)+50)
      .style('font-size', '11px').style('fill', '#388e3c')
      .text('← parity zone (M ≈ F)');

    //Axes
    svgBH.append('g')
      .attr('transform', `translate(0,${bHeight})`)
      .call(d3.axisBottom(bhXScale).tickFormat(d3.format('d')).ticks(10))
      .selectAll('text').style('font-size', '13px');

    svgBH.append('g')
      .call(d3.axisLeft(bhYScale).ticks(7))
      .selectAll('text').style('font-size', '13px');

    // Zero reference line
    svgBH.append('line')
      .attr('x1', 0).attr('x2', bWidth)
      .attr('y1', bhYScale(0)).attr('y2', bhYScale(0))
      .attr('stroke', '#aaa').attr('stroke-width', 0.8)
      .attr('stroke-dasharray', '4,3');

    //Axis labels
    svgBH.append('text')
      .attr('x', bWidth / 2).attr('y', bHeight + 55)
      .attr('text-anchor', 'middle').style('font-size', '15px')
      .text('Year');

    svgBH.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -bHeight / 2).attr('y', -bMargin.left + 140)
      .attr('text-anchor', 'middle').style('font-size', '13px')
      .text('Enrollment Differential from Parity Threshold (% points)');

    //title / subtitle
    svgBH.append('text')
      .attr('x', bWidth / 2).attr('y', -55)
      .attr('text-anchor', 'middle')
      .style('font-size', '20px').style('font-weight', 'bold')
      .text('Tertiary Enrollment Gap Persists Across Developing Nations');

    svgBH.append('text')
      .attr('x', bWidth / 2).attr('y', -28)
      .attr('text-anchor', 'middle')
      .style('font-size', '14px').style('fill', '#555')
      .text('Male enrollment persists well above parity threshold in all surveyed nations, 1995–2018');

    //Lines + dots
    const bhLine = d3.line()
      .x(d => bhXScale(d.year))
      .y(d => bhYScale(d.gap))
      .defined(d => !isNaN(d.gap));

    featuredCodes.forEach(code => {
      const cd = bhData.filter(d => d.country_code === code);
      if (cd.length === 0) return;

      svgBH.append('path')
        .datum(cd)
        .attr('fill', 'none')
        .attr('stroke', bhColor(code))
        .attr('stroke-width', 2.5)
        .attr('d', bhLine);

      svgBH.selectAll(null)
        .data(cd)
        .enter()
        .append('circle')
        .attr('r', 4)
        .attr('cx', d => bhXScale(d.year))
        .attr('cy', d => bhYScale(d.gap))
        .attr('fill', bhColor(code))
        .on('mouseover', function(event, d) {
          d3.select('#tooltip')
            .style('display', 'block')
            .html(`<strong>${featuredNames[d.country_code] || d.country}</strong><br/>
                   Year: ${d.year}<br/>
                   Male Enrollment: ${d.tertiary_m.toFixed(1)}%<br/>
                   Female Enrollment: ${d.tertiary_f.toFixed(1)}%<br/>
                   Gap (M − F): ${d.gap.toFixed(1)} pp`)
            .style('left', (event.pageX + 20) + 'px')
            .style('top',  (event.pageY - 28) + 'px');
          d3.select(this).attr('r', 6).style('stroke','#000').style('stroke-width','1.5px');
        })
        .on('mouseout', function() {
          d3.select('#tooltip').style('display','none');
          d3.select(this).attr('r', 4).style('stroke','none');
        });
    });

    //Legend 
    const legend = svgBH.append('g')
      .attr('transform', `translate(${bWidth +15}, 0)`);

    legend.append('text')
      .attr('x', 0).attr('y', 0)
      .style('font-size', '13px').style('font-weight', 'bold')
      .text('Surveyed Nations');

    featuredCodes.forEach((code, i) => {
      legend.append('rect')
        .attr('x', 0).attr('y', i * 22 + 12)
        .attr('width', 13).attr('height', 13)
        .attr('fill', bhColor(code));
      legend.append('text')
        .attr('x', 20).attr('y', i * 22 + 23)
        .style('font-size', '12px')
        .text(featuredNames[code] || code);
    });

    svgBH.append('text')
      .attr('x', 0).attr('y', bHeight + 72)
      .style('font-size', '11px').style('fill', '#888')
      .text('Source: World Bank Gender Statistics Database. Nations selected for longitudinal data completeness, 1995–2018.');

  });
}

drawBlackHat();