const projectID = queryStringValues.get('projectID');
const pfeOrigin = document.location.origin;
const pollInterval = 2000;

const maxPolls = 1000; // maxPolls * pollInterval = 2000000ms of data ~= 33 mins
const maxFlameGraphUpdates = 50;

function pollMetricsAndUpdateDash(numPolls, funcToUpdateDash) {
  tellPfeToScrapeMetricsFromProject();
  getProjectMetricsFromPfeThenUpdateDash(numPolls, funcToUpdateDash);
}

function getProjectMetricsFromPfeThenUpdateDash(numPollsRemaining, funcToUpdateDash) {
  $.ajax({
    method: 'GET',
    url: `${pfeOrigin}/performance/monitor`,
    data: {
      projectID,
    },
    error: logAjaxResponseError,
    success: funcToUpdateDash,
    complete: () => {
      numPollsRemaining--;
      if (numPollsRemaining > 0) {
        setTimeout(
          () => getProjectMetricsFromPfeThenUpdateDash(numPollsRemaining, funcToUpdateDash),
          pollInterval,
        );
        return;
      }
      console.log('Finished polling project');
    },
  });
}

function tellPfeToScrapeMetricsFromProject() {
  $.ajax({
    url: `${pfeOrigin}/performance/monitor?projectID=${projectID}`,
    type: 'POST',
    dataType: 'json',
    success: (data) => {
      console.log(data);
    }
  });
}

function getEnvDataAndUpdateEnvSummary() {
  $.ajax({
    method: 'GET',
    url: `${pfeOrigin}/performance/monitor/environment`,
    data: {
      projectID,
    },
    error: logAjaxResponseError,
    success: (resBody) => {
      // console.log("resBody");
      // console.log(resBody);
      envTable.populateTableJSON(JSON.stringify(resBody));
    },
  });
}

function logAjaxResponseError(jqXKR, textStatus, errorThrown) {
  console.log('jqXKR');
  console.log(jqXKR);
  console.log(`textStatus: ${textStatus}`);
  console.log(`errorThrown: ${errorThrown}`);
};
