const axios = require('axios');

const getResData = async (origin, path) => {
  const href = `${origin}${path}`;
  console.log(`[getResData] GET ${href}`);
  const res = await axios.get(href);
  // console.log('Received res.data');
  // console.log(res.data);
  return res.data;
};

module.exports = {
  getResData,
};
