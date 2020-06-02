// Aggregations
let demog = grok.data.testData('demog', 5000);

let avgAgesByRace = demog
    .groupBy(['race', 'sex'])
    .avg('age')
    .aggregate();

grok.shell.addTableView(avgAgesByRace);