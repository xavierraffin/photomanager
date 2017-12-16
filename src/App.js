import React, { Component } from 'react';
import StorageService from './services/storage.service';
import PhotoExplorer from './components/PhotoExplorer';
import SearchBar from './components/SearchBar';
import MainNavBar from './components/MainNavBar';
import Footer from './components/Footer';
import './App.css';

class App extends Component {
  constructor(props) {
    super(props);
    console.log('here');
    this.storageService = new StorageService(this);
    this.state = { storage : this.storageService.storage };
  }
  render() {
    console.log('render App, %s',this.state.storage);
    return (
      <div>
        <MainNavBar importCallBack={() => this.storageService.selectImportFolder()}/>
        <SearchBar />
        <PhotoExplorer value={this.state.storage}/>
        <Footer />
      </div>
    );
  }
}

export default App;
