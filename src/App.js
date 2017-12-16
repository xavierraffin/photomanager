import React, { Component } from 'react';
import { Grid, Navbar, Row, Col } from 'react-bootstrap';
import PhotoExplorer from './components/PhotoExplorer';
import SearchBar from './components/SearchBar';
import './App.css';

class App extends Component {
  render() {
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
        <PhotoExplorer />
      </div>
    );
  }
}

export default App;
