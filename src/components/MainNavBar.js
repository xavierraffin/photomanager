import React, { Component } from 'react';
import { NavItem, Navbar, Nav, Button, Glyphicon } from 'react-bootstrap';

class MainNavBar extends Component {
  render() {
    return (
        <Navbar inverse fixedTop className="MainNavBar">
          <Navbar.Header>
            <Navbar.Brand>
              PhotoManager
              {' '}
              <Button bsStyle="warning" onClick={this.props.importCallBack} active>
                <Glyphicon glyph="plus" />
                {' '}IMPORT
              </Button>
            </Navbar.Brand>
            <Navbar.Toggle />
          </Navbar.Header>
          <Navbar.Collapse>
            <Nav pullRight>
              <Button active>
                <Glyphicon glyph="zoom-out" />
                zoom out
              </Button>
              <Button active>
                <Glyphicon glyph="zoom-in" />
                zoom in
              </Button>
            </Nav>
          </Navbar.Collapse>
        </Navbar>
    );
  }
}

export default MainNavBar;
