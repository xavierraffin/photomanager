import React, { Component } from 'react';
import { ProgressBar, Grid, Row, Col } from 'react-bootstrap';
const { Logger, LOG_LEVEL } = require('../utils/Logger');
var logger = new Logger(LOG_LEVEL.DEBUG);
import './Footer.css';

class Footer extends Component {
constructor(props) {
  super(props);
  console.log('Footer constructor, percentage = %s', this.props.percentage);
  this.state = { percentage : this.props.percentage };
}

  render() {
    logger.log(LOG_LEVEL.DEBUG, 'render footer : percent = %s', this.state.percentage);
    return (
      <div className="footer">
        <Grid bsClass="footerGrid">
          <Row>
            <Col xs={6}>
            blabla
            </Col>
            <Col xs={6}>
              <ProgressBar className="importProgressBar" active now={this.state.percentage} />
            </Col>
          </Row>
        </Grid>
      </div>
    );
  }
}

export default Footer;
