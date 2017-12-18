import React, { Component } from 'react';
import StorageService from './services/storage.service';
import PhotoExplorer from './components/PhotoExplorer';
import SearchBar from './components/SearchBar';
import MainNavBar from './components/MainNavBar';
import Footer from './components/Footer';
const { Logger, LOG_LEVEL } = require('./utils/Logger');
var logger = new Logger(LOG_LEVEL.DEBUG);
import './App.css';

class App extends Component {
  constructor(props) {
    super(props);
    this.storageService = new StorageService(this);
    this.state = { storage : this.storageService.storage, percentage : 0 };
  }
  setImportProgress(percent) {
    logger.log(LOG_LEVEL.DEBUG, 'Appjs percent : %s', percent);
    this.footer.setState({ percentage : percent });
  }

  render() {
    logger.log(LOG_LEVEL.DEBUG,'render App, %s',this.state.storage);
    return (
      <div>
        <MainNavBar importCallBack={() => this.storageService.selectImportFolder()}/>
        <SearchBar />
        <PhotoExplorer value={this.state.storage}/>
        <Footer ref={(footer) => { this.footer = footer; }} percentage={this.state.percentage}/>
      </div>
    );
  }
}

export default App;
