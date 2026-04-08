import 'https://esm.sh/d3-transition';

console.log('D3 Version:', d3.version);

let allData = []
let xScale, yScale
const t = 1000; // 1000ms = 1 second

let xVar = 'year', yVar = 'secondary_enrollment_gap_gross', sizeVar = 'adolescent_fertility', targetCountryCode = "USA"
const options = ['secondary_enrollment_gap_gross', 'secondary_enrollment_gap_net', 'tertiary_enrollment_gap_gross']
const continents = ['Africa', 'Asia', 'Oceania', 'Americas', 'Europe']
const colorScale = d3.scaleOrdinal(continents, d3.schemeSet2); // d3.schemeSet2 is a set of predefined colors.
let lowerYear = 1980
let upperYear = 2018
let yMin = -60, yMax = 60;
const yLabels = {
  "secondary_enrollment_gap_gross": "Secondary Enrollment Gap (Gross %)",
  "secondary_enrollment_gap_net": "Secondary Enrollment Gap (Net %)",
  "tertiary_enrollment_gap_gross": "Tertiary Enrollment Gap (Gross %)"
};

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
    console.log("genderData", genderData)
    console.log("metadata", metadata)

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
    const currentMetadata = metaByCode.get(row.country_code)
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
      gapKeys.map(key => ({
        country: row.country,
        country_code: row.country_code,
        region: row.region,
        income_group: row.income_group,
        year: row.year,
        type: key,
        value: row[key],
        adolescent_fertility: row.adolescent_fertility
      }))
    );

    console.log("allData", allData)

   // yMin = d3.min(allData, d => d.value)
    //yMax = d3.max(allData, d => d.value)

    setupSelector()
    updateAxes()
    updateVis()
    addLegend()
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

    // select all dropdown buttons
    d3.selectAll('#myMeasurement')
    .on("change", function(event) {
        const dropdown = d3.select(this); 
        const dropdownId = dropdown.attr("id"); 
        const value = dropdown.property("value"); 

        if (dropdownId === "myCountry") {
            targetCountryCode = value;
        } else if (dropdownId === "myMeasurement") {
            yVar = value;
        }

        // redraw axes and visualization
        svg.selectAll('.axis').remove();
        svg.selectAll('.labels').remove();
        updateAxes();
        updateVis();
    });

    d3.select('#myCountry')
        .selectAll('option')
        .data(allData.filter(d => d.income_group !== "").sort().map(d => d.country_code).filter((v,i,a) => a.indexOf(v) == i)) 
        .enter()
        .append('option')
        .text(d => {
            const row = allData.find(row => row.country_code == d);
            return row.country;
        })
        .attr('value', d => d);

    d3.select('#myCountry').on('change', function(event){
        targetCountryCode = d3.select(this).property('value');
        svg.selectAll('.axis').remove();
        svg.selectAll('.labels').remove();
        updateAxes();
        updateVis();
    });
        

d3.select('#xVariable').property('value', xVar)
d3.select('#yVariable').property('value', yVar)
d3.select('#sizeVariable').property('value', sizeVar)
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

//create y scale
yScale = d3.scaleLinear()
  .domain([yMin, yMax])
  .range([height, 0]);
const yAxis = d3.axisLeft(yScale)

svg.append("g")
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

// Y-axis label (rotated)
svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -margin.left + 15)
    .attr("text-anchor", "middle")
    .text(yLabels[yVar]) // Displays the current y-axis variable
    .attr('class', 'labels')
 
svg.append('text')
    .attr('class', 'annotation top-right')
    .attr('x', width - 10)
    .attr('y', 10)  
    .attr('text-anchor', 'end') 
    .attr('dominant-baseline', 'hanging')
    .style('font-size', '14px')
    .style('font-weight', 'bold')
    .text('More Males Than Females');


svg.append('text')
    .attr('class', 'annotation bottom-right')
    .attr('x', width - 10) 
    .attr('y', height - 10)  
    .attr('text-anchor', 'end') 
    .attr('dominant-baseline', 'auto')
    .style('font-size', '14px')
    .style('font-weight', 'bold')
    .text('More Females Than Males');
}

function updateVis(){

    // Remove old background if it exists
svg.selectAll('.bg-half').remove();

// Top half blue
svg.append('rect')
    .attr('class', 'bg-half')
    .attr('x', 0)
    .attr('y', 0)  // top
    .attr('width', width)
    .attr('height', height / 2) // half the height
    .style('fill', 'lightblue')
    .style('opacity', 0.3);

// Bottom half red
svg.append('rect')
    .attr('class', 'bg-half')
    .attr('x', 0)
    .attr('y', (height) / 2)  // start at middle
    .attr('width', width)
    .attr('height', height / 2)
    .style('fill', 'lightcoral')
    .style('opacity', 0.3);

  // Draws (or updates) the bubbles
console.log("all data again", allData)
let filtered = allData.filter(d => d.country_code == targetCountryCode && d.year >= lowerYear && d.year <= upperYear && d.type == yVar)

console.log("filtered", filtered)

const currentData = filtered.sort((a,b) => a.year - b.year)

const line = d3.line()
  .x(d => xScale(d.year))
  .y(d => yScale(d.value))
  .defined(d => !isNaN(d.value));

svg.selectAll(".gap-line")
  .data([currentData]) 
  .join("path")
    .attr("class", "gap-line")
    .attr("fill", "none")
    .attr("stroke", "steelblue")
    .attr("stroke-width", 2)
    .attr("d", line);

const filteredDots = currentData.filter(d => !isNaN(d.value));

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
            .style('fill', "steelblue")
            .style('opacity', 1) // Slight transparency for better visibility
            .attr('r', 0) // before transition r = 0
            .on('mouseover', function (event, d) {
                console.log(d) // See the data point in the console for debugging
                d3.select('#tooltip')
                    .style("display", 'block') // Make the tooltip visible
                    .html( // Change the html content of the <div> directly
                    `<strong>${d.country}</strong><br/>
                    Region: ${d.region}<br/>
                    Income Group: ${d.income_group}<br/>
                    Year: ${d.year}<br/>
                    Gender Gap: ${d.value.toFixed(1)}`)
                    .style("left", (event.pageX + 20) + "px")
                    .style("top", (event.pageY - 28) + "px");
                d3.select(this) // Refers to the hovered circle
                .style('stroke', 'black')
                .style('stroke-width', '2px')
            })
            .on("mouseout", function (event, d) {
                d3.select('#tooltip')
                .style('display', 'none') // Hide tooltip when cursor leaves
                 d3.select(this) // Refers to the hovered circle
                .style('stroke', 'black')
                .style('stroke-width', '0px')
                 .style('opacity', 1)
            })
            .transition(t)
            .attr('r', 5)
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
    let size = 10  // Size of the legend squares
    svg.selectAll('continentSquare')
    .data(continents)
    .enter()
    .append("rect")
    .attr("x", (d,i) => i * (size + 100) + 100)
    .attr("y", -margin.top/2) 
    .attr("width", size)
    .attr("height", size)
    .style("fill", d => colorScale(d))

      svg.selectAll("continentName")
        .data(continents)
        .enter()
        .append("text")
        .attr("y", -margin.top/2 + size) // Align vertically with the square
        .attr("x", (d, i) => i * (size + 100) + 120)  
        .style("fill", d => colorScale(d))  // Match text color to the square
        .text(d => d) // The actual continent name
        .attr("text-anchor", "left")
        .style('font-size', '13px')

}

window.addEventListener('load', init);

//make margins
const margin = {top: 40, right: 40, bottom: 40, left: 60};
const width = 800 - margin.left - margin.right;
const height = 600 - margin.top - margin.bottom;

// Create SVG
const svg = d3.select('#whitehat-vis')
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

