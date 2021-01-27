'use strict';

let _cloudWatchLogsService = null;
let _cloudFormationService = null;

class ServerlessCloudWatchLogsTagPlugin {

  get stackName() {
    return `${this.serverless.service.service}-${this.options.stage}`;
  }

  get logGroupService() {

    if (!_cloudWatchLogsService)
      _cloudWatchLogsService = new this.awsService.sdk.CloudWatchLogs({ region: this.options.region });

    return _cloudWatchLogsService;
  }

  get cloudWatchLogsService() {

    if (!_cloudFormationService)
      _cloudFormationService = new this.awsService.sdk.CloudFormation({ region: this.options.region });

    return _cloudFormationService;
  }

  constructor(serverless, options) {

    this.options = options;
    this.resources = [];
    this.serverless = serverless;
    this.awsService = this.serverless.getProvider('aws');

    this.hooks = {
      'after:deploy:deploy': this.execute.bind(this),
    };
  }

  execute() {
    return this.getStackResources()
      .then(data => this.tagCloudWatchLogs(data))
      .then(data => this.serverless.cli.log(JSON.stringify(data)))
      .catch(err => this.serverless.cli.log(JSON.stringify(err)));
  }

  getStackResources() {
    return new Promise((resolve, reject) => {
      console.log('Executing listStackResources');
      const StackResources = [];
      this.cloudWatchLogsService.listStackResources({ StackName: this.stackName}, (err, data) => {
        console.log(data);
        if (err) return reject(err);
        this.resources.push(...(data.StackResourceSummaries || []));
        if (data.NextToken) {
          console.log('Starting fetching pages')
          let token = data.NextToken;
          return this.getStackResourceWithToken({ StackName: this.stackName, NextToken: token })
        }
      });
      return resolve(StackResources)
    });
  }

  getStackResourceWithToken(token)  {
    return new Promise((resolve, reject) => {
      console.log('Executing listStackResources by token ', token);
      this.cloudWatchLogsService.listStackResources({ StackName: this.stackName, NextToken: token}, (err, data) => {
        console.log(data);
        if (err) return reject(err);
        this.resources.push(...(data.StackResourceSummaries || []));
        if (data.NextToken) {
          return getStackResourceWithToken(data.NextToken);
        }
      });
      return resolve(this.resources)
    });
  }

  tagCloudWatchLogs(data) {
    const cloudWatchResources = (data).filter(item => { return item.ResourceType === 'AWS::Logs::LogGroup' });

    const promises = (cloudWatchResources).map(item => {
      return new Promise((resolve, reject) => {
        console.log(item);
        const params = {
          logGroupName: item.PhysicalResourceId,
          tags: this.serverless.service.custom.cloudWatchLogsTags
        };

        this.logGroupService.tagLogGroup(params, (err, apiData) => {
          if (err) return reject(err);
          resolve(`Tagged LogGroup ${item.LogicalResourceId}`);
        });
      });
    });

    return Promise.all(promises);
  }
}

module.exports = ServerlessCloudWatchLogsTagPlugin;
