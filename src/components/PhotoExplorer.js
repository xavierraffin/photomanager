import React, { Component } from 'react';
import { Grid, Row, Col } from 'react-bootstrap';
import './PhotoExplorer.css';

class PhotoExplorer extends Component {
  createRow() {
    return (
      <Col className="photoBox" xs={12} sm={6} md={3} lg={2}>
        <div className="photoCell">
        </div>
      </Col>
    )
  }

  render() {
    var cells = [];
    for (var i = 0; i < 100; i++) {
      cells[i] = this.createRow();
    }
    return (
      <Grid bsClass="photoGrid">
        <Row bsClass="reset">
          {cells}
        </Row>
      </Grid>
    );
  }
}

export default PhotoExplorer;
