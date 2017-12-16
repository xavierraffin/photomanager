import React, { Component } from 'react';
import { Grid, Row, Col } from 'react-bootstrap';
import './PhotoExplorer.css';

class PhotoExplorer extends Component {
  render() {
    return (
      <Grid bsClass="photoGrid">
        <Row bsClass="reset">
          <Col className="photoBox" xs={12} sm={6} md={3} lg={2}>
            <div className="photoCell">
            </div>
          </Col>
          <Col className="photoBox" xs={12} sm={6} md={3} lg={2}>
            <div className="photoCell">
            </div>
          </Col>
          <Col className="photoBox" xs={12} sm={6} md={3} lg={2}>
            <div className="photoCell">
            </div>
          </Col>
          <Col className="photoBox" xs={12} sm={6} md={3} lg={2}>
            <div className="photoCell">
            </div>
          </Col>
          <Col className="photoBox" xs={12} sm={6} md={3} lg={2}>
            <div className="photoCell">
            </div>
          </Col>
          <Col className="photoBox" xs={12} sm={6} md={3} lg={2}>
            <div className="photoCell">
            </div>
          </Col>
          <Col className="photoBox" xs={12} sm={6} md={3} lg={2}>
            <div className="photoCell">
            </div>
          </Col>
          <Col className="photoBox" xs={12} sm={6} md={3} lg={2}>
            <div className="photoCell">
            </div>
          </Col>
        </Row>
      </Grid>
    );
  }
}

export default PhotoExplorer;
