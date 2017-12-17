import React, { Component } from 'react';
import { ProgressBar, Grid, Row, Col } from 'react-bootstrap';
import './Footer.css';

class Footer extends Component {
  render() {
    return (
      <div className="footer">
        <Grid bsClass="footerGrid">
          <Row>
            <Col xs={6}>
            blabla
            </Col>
            <Col xs={6}>
              <ProgressBar className="importProgressBar" active now={this.props.percentage} />
            </Col>
          </Row>
        </Grid>
      </div>
    );
  }
}

export default Footer;
