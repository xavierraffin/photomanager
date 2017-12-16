import React, { Component } from 'react';
import { Grid, Navbar } from 'react-bootstrap';
import StorageService from './services/storage.service';
import PhotoExplorer from './components/PhotoExplorer';
import SearchBar from './components/SearchBar';
import './App.css';

class App extends Component {
  constructor(props) {
    super(props);
    console.log('here');
    var storageService = new StorageService(this);
    this.state = { storage : storageService.storage };
  }
  render() {
    console.log('render App, %s',this.state.storage);
    return (
      <div>
        <Navbar inverse fixedTop className="mainNavBar">
          <Grid>
            <Navbar.Header>
              <Navbar.Brand>
                <a href="/">PhotoManager</a>
              </Navbar.Brand>
              <Navbar.Toggle />
            </Navbar.Header>
          </Grid>
        </Navbar>
        <SearchBar />
        <PhotoExplorer value={this.state.storage}/>
      </div>
    );
  }
}

export default App;
